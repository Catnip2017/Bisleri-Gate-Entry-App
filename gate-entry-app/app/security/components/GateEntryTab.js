// app/security/components/GateEntryTab.js - MERGED with FG/RM Toggle
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Checkbox from "expo-checkbox";
import styles from "../styles/gateEntryStyles";
import { useRouter } from "expo-router";
import {
  gateAPI,
  rmAPI,
  handleAPIError,
  validationAPI,
  gateHelpers,
} from "../../../services/api";
import { showAlert } from "../../../utils/customModal";
import {
  validateVehicleNo,
  validateDriverName,
  validateKMReading,
  validateLoaderCount,
  validateLoaderNames,
  validateOperationalData,
} from "../../../utils/validators";
import DataTable from "../../../components/ui/DataTable";

const GateEntryTab = ({
  gateEntryData,
  onDataChange,
  userData,
}) => {
  const router = useRouter();

  // Any admin role (IT Admin or Security Admin) viewing this tab is
  // restricted to Vehicle Search only — no write access (manual entry,
  // operational fields, RM entry, or submission).
  const userRoles = userData?.roles || [];
  const isRestricted = userRoles.includes('itadmin') || userRoles.includes('securityadmin');
  const restrictedMessage =
    'Restricted access — you can only search vehicle records. Manual entry and submission are disabled for your role.';

  // ✅ MERGED: Entry type toggle (FG or RM)
  const [entryType, setEntryType] = useState("FG");

  // ✅ MERGED: State management for FG Entry
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState(null);

  // ✅ NEW: Operational data validation state
  const [operationalData, setOperationalData] = useState({
    driver_name: "",
    km_reading: "",
    loader_count: "",   // ✅ ADD THIS
    loader_names: "",
  });

  const [validationErrors, setValidationErrors] = useState({
    driver_name: "",
    km_reading: "",
    loader_count: "",   // ✅ ADD THIS
    loader_names: "",
  });

  const [fieldValidation, setFieldValidation] = useState({
    driver_name: { isValid: false, touched: false },
    km_reading: { isValid: false, touched: false },
    loader_count: { isValid: false, touched: false },  // ✅ ADD
    loader_names: { isValid: false, touched: false },
  });

  // ✅ Validation now lives in utils/validators.js (shared with OperationalEditModal)
  const updateOperationalField = (field, value) => {
    let validation;
    let cleanValue = value;

    switch (field) {
      case "driver_name":
        validation = validateDriverName(value);
        break;
      case "km_reading":
        cleanValue = value.replace(/[^0-9]/g, "");
        validation = validateKMReading(cleanValue);
        break;
      case "loader_count":
        cleanValue = value.replace(/[^0-9]/g, "");
        validation = validateLoaderCount(cleanValue);
        break;
      case "loader_names":
        validation = validateLoaderNames(value);
        break;
      default:
        validation = { isValid: true, error: "" };
    }

    setOperationalData((prev) => ({
      ...prev,
      [field]: cleanValue,
    }));

    setValidationErrors((prev) => ({
      ...prev,
      [field]: validation.error,
    }));

    setFieldValidation((prev) => ({
      ...prev,
      [field]: { isValid: validation.isValid, touched: true },
    }));
  };

  // ✅ MERGED: State management for RM Entry
  const [rmFormData, setRMFormData] = useState({
    gateType: "Gate-In",
    vehicleNo: "",
    documentNo: "",
    nameOfParty: "",
    descriptionOfMaterial: "",
    quantity: "",
  });

  // ✅ FIX C15: single source of truth — the checkbox state. The old
  // isEmptyVehicleRef was never written to, so validation always demanded a
  // document number even for empty vehicles (guards were stuck).
  const [isEmptyVehicle, setIsEmptyVehicle] = useState(false);

  // ✅ MERGED: RM form handlers
  const updateRMField = (field, value) => {
    setRMFormData({
      ...rmFormData,
      [field]: value,
    });
  };

  const validateRMForm = (emptyVehicle = isEmptyVehicle) => {
    const vehicleCheck = validateVehicleNo(rmFormData.vehicleNo);
    if (!vehicleCheck.isValid) {
      showAlert("Validation Error", vehicleCheck.error);
      return false;
    }

    // ✅ FIX C15: document number is only required when NOT an empty vehicle.
    // Reads the live checkbox state instead of the dead ref.
    if (!emptyVehicle && !rmFormData.documentNo.trim()) {
      showAlert("Validation Error", "Document number is required");
      return false;
    }

    if (!rmFormData.nameOfParty.trim()) {
      showAlert("Error", "Name of Party is required");
      return false;
    }

    if (!rmFormData.descriptionOfMaterial.trim()) {
      showAlert("Error", "Description of Material is required");
      return false;
    }

    if (!rmFormData.quantity.trim()) {
      showAlert("Error", "Quantity is required");
      return false;
    }

    return true;
  };

  const handleRMSubmit = async () => {
    if (!validateRMForm()) return;

    showAlert(
      "Confirm Submission",
      `Create ${rmFormData.gateType} entry for vehicle ${rmFormData.vehicleNo}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: performRMSubmit },
      ]
    );
  };

  const performRMSubmit = async () => {
    setIsSubmitting(true);

    try {
      const entryData = {
        gate_type: rmFormData.gateType,
        vehicle_no: rmFormData.vehicleNo.trim(),
        document_no: isEmptyVehicle ? "" : rmFormData.documentNo.trim(),
        name_of_party: rmFormData.nameOfParty.trim(),
        description_of_material: rmFormData.descriptionOfMaterial.trim(),
        quantity: rmFormData.quantity.trim(),
        is_empty_vehicle: isEmptyVehicle,
      };

      const response = await rmAPI.createRMEntry(entryData);

      showAlert(
        "Success",
        `Raw Materials ${
          rmFormData.gateType
        } created successfully!\n\nGate Entry No: ${
          response.gate_entry_no
        }\nVehicle: ${response.vehicle_no}\nDateTime: ${new Date(
          response.date_time
        ).toLocaleString()}`,
        [
          {
            text: "OK",
            onPress: () => {
              setRMFormData({
                gateType: "Gate-In",
                vehicleNo: "",
                documentNo: "",
                nameOfParty: "",
                descriptionOfMaterial: "",
                quantity: "",
              });
              setIsEmptyVehicle(false);
            },
          },
        ]
      );
    } catch (error) {
      console.log("RM entry submission failed:", error);
      showAlert("Error", handleAPIError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRMClear = () => {
    showAlert("Clear All", "Are you sure you want to clear all fields?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setRMFormData({
            gateType: "Gate-In",
            vehicleNo: "",
            documentNo: "",
            nameOfParty: "",
            descriptionOfMaterial: "",
            quantity: "",
          });
          setIsEmptyVehicle(false);
        },
      },
    ]);
  };

  // ✅ MERGED: FG Entry handlers (existing logic)
  const updateField = (field, value) => {
    onDataChange({
      ...gateEntryData,
      [field]: value,
    });
  };

  // ✅ FIX C16: ONE place builds the manual-entry route. Previously two
  // hand-assembled URL strings diverged (the empty-vehicle path dropped
  // loaderCount), so pre-fill depended on which button the guard used.
  const buildManualEntryRoute = () => {
    const params = [
      ["vehicle", gateEntryData.vehicleNo || ""],
      ["gateType", gateEntryData.gateType || "Gate-In"],
      ["driverName", operationalData.driver_name || ""],
      ["kmReading", operationalData.km_reading || ""],
      ["loaderCount", operationalData.loader_count || ""],
      ["loaderNames", operationalData.loader_names || ""],
    ]
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join("&");
    return `/security/manual-entry?${params}`;
  };

  // Shared pre-navigation / pre-submit check for operational fields.
  // Marks all fields touched so inline errors render, and returns the
  // first error for the popup (single source of truth — no more three
  // divergent copies of this alert chain).
  const checkOperationalFields = () => {
    const result = validateOperationalData(operationalData);

    setValidationErrors(result.errors);
    setFieldValidation({
      driver_name: { isValid: !result.errors.driver_name, touched: true },
      km_reading: { isValid: !result.errors.km_reading, touched: true },
      loader_count: { isValid: !result.errors.loader_count, touched: true },
      loader_names: { isValid: !result.errors.loader_names, touched: true },
    });

    if (!result.isValid) {
      showAlert("Validation Error", result.firstError);
    }
    return result.isValid;
  };

  const handleDocumentSelection = (documentNo, isSelected) => {
    if (isSelected) {
      setSelectedDocuments((prev) => [...prev, documentNo]);
    } else {
      setSelectedDocuments((prev) => prev.filter((doc) => doc !== documentNo));
    }
  };

  const handleVehicleSearch = async () => {
    const vehicleNo = gateEntryData.vehicleNo?.trim();

    if (!vehicleNo) {
      showAlert("Error", "Please enter vehicle number");
      return;
    }

    if (isSearching) {
      return;
    }

    setIsSearching(true);
    setSearchResults(null);
    setSelectedDocuments([]);
    setVehicleStatus(null);

    try {
      const status = await gateAPI.getVehicleStatus(vehicleNo);
      setVehicleStatus(status);

      const selectedGateType = gateEntryData.gateType;
      const sequenceError = validationAPI.getGateSequenceError(
        status,
        selectedGateType
      );

      if (sequenceError) {
        showAlert("Error", sequenceError);
        setIsSearching(false);
        return;
      }

      try {
        const results = await gateAPI.searchRecentDocuments(vehicleNo);
        setSearchResults(results);
      } catch (searchError) {
        if (searchError.response?.status === 404) {
          setSearchResults({ count: 0, documents: [] });
        } else {
          throw searchError;
        }
      }
    } catch (error) {
      console.log("Vehicle search error:", error);

      if (
        error.response?.status === 400 &&
        error.response.data.detail.includes("already has Gate")
      ) {
        showAlert("Gate Sequence Error", error.response.data.detail);
      } else {
        const errorMessage = handleAPIError(error);
        showAlert("Search Error", errorMessage);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnhancedSubmit = async () => {
    if (isRestricted) {
      showAlert('Restricted Access', restrictedMessage);
      return;
    }

    const vehicleNo = gateEntryData.vehicleNo?.trim();

    if (isSubmitting) {
      return;
    }

    if (!vehicleNo) {
      showAlert("Validation Error", "Please enter vehicle number");
      return;
    }

    if (!searchResults) {
      showAlert("Validation Error", "Please search for documents first");
      return;
    }

    // ✅ Shared operational-field validation (was a 30-line inline alert chain)
    if (!checkOperationalFields()) {
      return;
    }

    if (gateHelpers.isEmptyVehicle(searchResults)) {
      showAlert(
        'Empty Vehicle Detected',
        'This vehicle has no documents. Would you like to create a manual entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Manual Entry',
            // ✅ FIX C16: shared route builder — loaderCount is no longer dropped
            onPress: () => router.push(buildManualEntryRoute()),
          }
        ]
      );
      return;
    }

    if (selectedDocuments.length === 0) {
      showAlert("Error", "Please select at least one document");
      return;
    }

    showAlert(
      "Confirm Submission",
      `Submit ${gateEntryData.gateType} for ${selectedDocuments.length} document(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            await performSubmission();
          },
        },
      ]
    );
  };

  const performSubmission = async () => {
    setIsSubmitting(true);

    try {
      // Validate operational data before submission
      const allFieldsValid =
        fieldValidation.driver_name.isValid &&
        fieldValidation.km_reading.isValid &&
        fieldValidation.loader_count.isValid &&
        fieldValidation.loader_names.isValid;

      if (!allFieldsValid) {
        showAlert(
          "Error",
          "Please complete all required operational fields correctly before submitting."
        );
        return;
      }

      const batchData = {
        gate_type: gateEntryData.gateType,
        vehicle_no: gateEntryData.vehicleNo?.trim(),
        document_nos: selectedDocuments,
        remarks: gateEntryData.remarks || null,
        driver_name: operationalData.driver_name.trim(),
        km_reading: operationalData.km_reading,
        loader_names: operationalData.loader_names.trim(),
        loader_count: operationalData.loader_count,   // ✅ ADD

      };

      const result = await gateAPI.createEnhancedBatchGateEntry(batchData);

      const successMessage = gateHelpers.formatSuccessMessage(result, false);

      showAlert("Success", successMessage);

      setSearchResults(null);
      setSelectedDocuments([]);
      setVehicleStatus(null);

      onDataChange({
        gateType: "Gate-In",
        vehicleNo: "",
        transporterName: "",
        driverName: "",
        kmIn: "",
        kmOut: "",
        loaderNames: "",
        remarks: "",
        gateEntryNo: "",
        dateTime: "",
      });

      setOperationalData({
        driver_name: "",
        km_reading: "",
        loader_names: "",
        loader_count: "",
      });

      setValidationErrors({
        driver_name: "",
        km_reading: "",
        loader_names: "",
        loader_count: "",
      });

      setFieldValidation({
        driver_name: { isValid: false, touched: false },
        km_reading: { isValid: false, touched: false },
        loader_count: { isValid: false, touched: false },
        loader_names: { isValid: false, touched: false },
      });
    } catch (error) {
      console.log("Batch gate entry submission failed:", error);

      if (
        error.response?.status === 400 &&
        error.response.data.detail.includes("already has Gate")
      ) {
        showAlert("Gate Sequence Error", error.response.data.detail);
      } else {
        const errorMessage = handleAPIError(error);
        showAlert("Submission Error", errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearButtonPress = () => {
    if (entryType === "RM") {
      handleRMClear();
    } else {
      showAlert("Clear All", "Are you sure you want to clear all fields?", [
        { text: "CANCEL", style: "cancel" },
        {
          text: "CLEAR",
          style: "destructive",
          onPress: () => {
            setSearchResults(null);
            setSelectedDocuments([]);
            setVehicleStatus(null);

            onDataChange({
              gateType: "Gate-In",
              vehicleNo: "",
              transporterName: "",
              driverName: "",
              kmIn: "",
              kmOut: "",
              loaderNames: "",
              remarks: "",
              gateEntryNo: "",
              dateTime: "",
            });
          },
        },
      ]);
    }
  };

  // ✅ NEW: Column-priority config for the shared DataTable.
  // priority 1 = always visible (the data guards act on);
  // priority 2 = inside the expandable row detail panel.
  const documentColumns = useMemo(
    () => [
      { key: "document_no", title: "Document No.", flex: 1.4, priority: 1 },
      { key: "document_type", title: "Doc Type", flex: 1, priority: 1 },
      {
        key: "document_date",
        title: "Doc Date",
        flex: 1,
        priority: 1,
        render: (doc) =>
          doc.document_date
            ? new Date(doc.document_date).toLocaleDateString()
            : "—",
      },
      { key: "customer_name", title: "Customer", flex: 1.6, priority: 1 },
      { key: "total_quantity", title: "Qty", flex: 0.6, priority: 1 },
      {
        key: "gate_entry_no",
        title: "Gate Entry No.",
        priority: 2,
        render: (doc) => doc.gate_entry_no || "Not yet assigned",
      },
      { key: "sub_document_type", title: "Sub Doc Type", priority: 2 },
      { key: "vehicle_no", title: "Vehicle No.", priority: 2 },
      { key: "to_warehouse_code", title: "To Warehouse", priority: 2 },
      { key: "site", title: "Site", priority: 2 },
      { key: "route_code", title: "Route Code", priority: 2 },
      { key: "transporter_name", title: "Transporter", priority: 2 },
      { key: "direct_dispatch", title: "Direct Dispatch", priority: 2 },
    ],
    []
  );

  const renderDocumentTable = () => {
    if (!searchResults) return null;

    if (searchResults.count === 0) {
      return (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>Empty Vehicle Detected</Text>
          <Text style={styles.noResultsSubtext}>
            No documents found for this vehicle within the last 48 hours. This
            appears to be an empty vehicle. Use the Manual Entry button below
            to record its passage.
          </Text>
        </View>
      );
    }

    // ✅ Shared DataTable: 5 primary columns always visible (no horizontal
    // scrolling), full row tap toggles selection, chevron expands the
    // remaining details. Replaces the 14-column 1,330px-wide scroll table.
    return (
      <View style={{ marginTop: 16 }}>
        <DataTable
          columns={documentColumns}
          data={searchResults.documents}
          keyExtractor={(doc) => doc.document_no}
          selectable
          selectedKeys={selectedDocuments}
          onToggleSelect={(key, doc, selected) =>
            handleDocumentSelection(key, selected)
          }
          emptyText="No documents found for this vehicle"
        />
        <Text style={styles.selectedCountText}>
          Tap a row to select it for submission. Tap the arrow for full details.
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.cardContainer}
    >
      {/* ✅ MERGED: Entry Type Toggle (FG/RM) */}
      <View style={styles.entryTypeContainer}>
        <Text style={styles.entryTypeLabel}>Entry Type:</Text>
        <View style={styles.entryTypeRow}>
          {["FG", "RM"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.entryTypeButton,
                entryType === type && styles.entryTypeButtonActive,
              ]}
              onPress={() => setEntryType(type)}
              disabled={isSubmitting || isSearching}
            >
              <Text
                style={[
                  styles.entryTypeButtonText,
                  entryType === type && styles.entryTypeButtonTextActive,
                ]}
              >
                {type} Entry
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ✅ MERGED: Conditional Form Rendering */}
      {entryType === "FG" ? (
        // FG Entry Form (existing logic)
        <>
          <Text style={styles.sectionTitle}>FG Vehicle Entry Details</Text>

          <View style={styles.row}>
            <View style={styles.field33}>
              <Text style={styles.label}>Gate Type:</Text>
              <View style={styles.radioRow}>
                {["Gate-In", "Gate-Out"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radioButton}
                    onPress={() => updateField("gateType", type)}
                    disabled={isSubmitting || isSearching}
                  >
                    <View style={styles.radioCircle}>
                      {gateEntryData.gateType === type && (
                        <View style={styles.selectedDot} />
                      )}
                    </View>
                    <Text>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field33}>
              <Text style={styles.label}>Gate Entry No</Text>
              <TextInput
                style={styles.input}
                placeholder="Auto-generated"
                value={gateEntryData.gateEntryNo || ""}
                editable={false}
              />
            </View>

            <View style={styles.field33}>
              <Text style={styles.label}>Date & Time</Text>
              <TextInput
                style={styles.input}
                placeholder="Auto-filled"
                value={gateEntryData.dateTime || ""}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field40}>
              <Text style={styles.label}>Vehicle No *</Text>
              <View style={styles.vehicleInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Enter Vehicle No"
                  value={gateEntryData.vehicleNo || ""}
                  onChangeText={(text) =>
                    updateField("vehicleNo", text.toUpperCase())
                  }
                  autoCapitalize="characters"
                  editable={!isSubmitting && !isSearching}
                  returnKeyType="search"
                  onSubmitEditing={handleVehicleSearch}
                />
                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    (isSearching || isSubmitting) && styles.buttonDisabled,
                  ]}
                  onPress={handleVehicleSearch}
                  disabled={isSearching || isSubmitting}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field35}>
              <Text style={styles.label}>Driver Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  fieldValidation.driver_name.touched &&
                    !fieldValidation.driver_name.isValid &&
                    styles.inputError,
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder="Enter Driver Name"
                value={operationalData.driver_name}
                onChangeText={(text) =>
                  updateOperationalField("driver_name", text)
                }
                editable={!isSubmitting && !isSearching && !isRestricted}
                autoCapitalize="words"
              />
              {fieldValidation.driver_name.touched &&
              validationErrors.driver_name ? (
                <Text style={styles.errorText}>
                  {validationErrors.driver_name}
                </Text>
              ) : null}
            </View>

            <View style={styles.field10}>
              <Text style={styles.label}>
                {gateEntryData.gateType === "Gate-Out" ? "KM OUT *" : "KM IN *"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  fieldValidation.km_reading.touched &&
                    !fieldValidation.km_reading.isValid &&
                    styles.inputError,
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder={
                  gateEntryData.gateType === "Gate-Out"
                    ? "Enter KM OUT"
                    : "Enter KM IN"
                }
                keyboardType="numeric"
                value={operationalData.km_reading}
                onChangeText={(text) =>
                  updateOperationalField("km_reading", text)
                }
                editable={!isSubmitting && !isSearching && !isRestricted}
                maxLength={6}
              />
              {fieldValidation.km_reading.touched &&
              validationErrors.km_reading ? (
                <Text style={styles.errorText}>
                  {validationErrors.km_reading}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field33}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, isRestricted && styles.inputDisabled]}
                placeholder="Optional"
                value={gateEntryData.remarks || ""}
                onChangeText={(text) => updateField("remarks", text)}
                editable={!isSubmitting && !isSearching && !isRestricted}
              />
            </View>

           <View style={[styles.field10, { marginHorizontal: 4 }]}>
              <Text style={styles.label}>Loader Count *</Text>

              <TextInput
                style={[
                  styles.input,
                  fieldValidation.loader_count.touched &&
                    !fieldValidation.loader_count.isValid &&
                    styles.inputError,
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder="Count"
                value={operationalData.loader_count}
                onChangeText={(text) =>
                  updateOperationalField("loader_count", text)
                }
                keyboardType="numeric"
                maxLength={2}
                editable={!isSubmitting && !isSearching && !isRestricted}
              />

              {fieldValidation.loader_count.touched &&
              validationErrors.loader_count ? (
                <Text style={styles.errorText}>
                  {validationErrors.loader_count}
                </Text>
              ) : null}
            </View>

            <View style={styles.field25}>
              <Text style={styles.label}>Loader Names *</Text>
              <TextInput
                style={[
                  styles.input,
                  fieldValidation.loader_names.touched &&
                    !fieldValidation.loader_names.isValid &&
                    styles.inputError,
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder="Enter Loader Names (comma-separated)"
                value={operationalData.loader_names}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^a-zA-Z\s,]/g, '');
                  updateOperationalField("loader_names", cleaned);
                }}
                editable={!isSubmitting && !isSearching && !isRestricted}
                maxLength={200}
              />
              {fieldValidation.loader_names.touched &&
              validationErrors.loader_names ? (
                <Text style={styles.errorText}>
                  {validationErrors.loader_names}
                </Text>
              ) : null}
            </View>
          </View>

          {vehicleStatus && vehicleStatus.status === "active" && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Vehicle Status:</Text>
              <Text style={styles.statusText}>
                Last Movement: {vehicleStatus.last_movement.type} on{" "}
                {new Date(
                  vehicleStatus.last_movement.date
                ).toLocaleDateString()}
              </Text>
            </View>
          )}

          {searchResults && (
            <View style={styles.searchResultsContainer}>
              <Text style={styles.searchResultsTitle}>
                Search Results for {gateEntryData.vehicleNo} (
                {searchResults.count} documents found)
              </Text>
              {selectedDocuments.length > 0 && (
                <Text style={styles.selectedCountText}>
                  {selectedDocuments.length} document(s) selected for submission
                </Text>
              )}
            </View>
          )}

          {renderDocumentTable()}

          {/* Explain WHY Submit is disabled — a grey button that swallows
              taps teaches guards nothing */}
          {!isRestricted && (!searchResults || selectedDocuments.length === 0) && (
            <Text
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "#856404",
                marginTop: 16,
              }}
            >
              {!searchResults
                ? "Search a vehicle number to load its documents."
                : "Select at least one document above to enable Submit."}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                // ✅ ALWAYS disabled if no documents selected OR no search results
                (!searchResults || selectedDocuments.length === 0 || isRestricted) && styles.buttonDisabled
              ]}
              onPress={handleEnhancedSubmit}
              disabled={!searchResults || selectedDocuments.length === 0 || isRestricted}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>
                  {isRestricted
                    ? 'View Only'
                    : `Submit (${selectedDocuments.length} selected)`}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.manualButton,
                (isSubmitting || isSearching || isRestricted) && styles.buttonDisabled
              ]}
              onPress={() => {
                if (isRestricted) {
                  showAlert('Restricted Access', restrictedMessage);
                  return;
                }
                // ✅ Shared operational validation + shared route builder (FIX C16)
                if (!checkOperationalFields()) {
                  return;
                }
                router.push(buildManualEntryRoute());
              }}
              disabled={isSubmitting || isSearching || isRestricted}
            >
              <Text style={styles.buttonText}>Manual Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.clearButton,
                (isSubmitting || isSearching) && styles.buttonDisabled,
              ]}
              onPress={handleClearButtonPress}
              disabled={isSubmitting || isSearching}
            >
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // ✅ MERGED: RM Entry Form
        <>
          <Text style={styles.sectionTitle}>Raw Materials Entry</Text>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Gate Type:</Text>
              <View style={styles.radioRow}>
                {["Gate-In", "Gate-Out"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radioButton}
                    onPress={() => updateRMField("gateType", type)}
                    // Match the FG radio: toggling is allowed even in view-only
                    // mode (submission stays blocked for restricted roles).
                    disabled={isSubmitting}
                  >
                    <View style={styles.radioCircle}>
                      {rmFormData.gateType === type && (
                        <View style={styles.selectedDot} />
                      )}
                    </View>
                    <Text>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Vehicle Number *</Text>
              <TextInput
                style={[styles.input, isRestricted && styles.inputDisabled]}
                placeholder="Enter Vehicle Number"
                value={rmFormData.vehicleNo}
                onChangeText={(text) =>
                  updateRMField("vehicleNo", text.toUpperCase())
                }
                autoCapitalize="characters"
                editable={!isSubmitting && !isRestricted}
              />
            </View>
          </View>

          {/* Empty Vehicle Checkbox */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, marginTop: 4 }}>
            <Checkbox
              value={isEmptyVehicle}
              onValueChange={(newValue) => {
                setIsEmptyVehicle(newValue);
                if (newValue) {
                  setRMFormData((prev) => ({ ...prev, documentNo: "" }));
                }
              }}
              disabled={isSubmitting || isRestricted}
              color={isEmptyVehicle ? "#00A651" : undefined}
            />
            <Text style={{ marginLeft: 8, fontSize: 14, color: "#333" }}>
              Empty Vehicle (No Document)
            </Text>
          </View>

          {/* Document Number — greyed out when empty vehicle */}
          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={[styles.label, isEmptyVehicle && { color: "#aaa" }]}>
                Document Number {isEmptyVehicle ? "(Not Required)" : "*"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  isEmptyVehicle && { backgroundColor: "#f0f0f0", color: "#aaa" },
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder={isEmptyVehicle ? "N/A — Empty Vehicle" : "Enter Document Number"}
                value={rmFormData.documentNo}
                onChangeText={(text) => updateRMField("documentNo", text)}
                editable={!isSubmitting && !isEmptyVehicle && !isRestricted}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Name of Party *</Text>
              <TextInput
                style={[styles.input, isRestricted && styles.inputDisabled]}
                placeholder="Enter Name of Party"
                value={rmFormData.nameOfParty}
                onChangeText={(text) => updateRMField("nameOfParty", text)}
                editable={!isSubmitting && !isRestricted}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Description of Material *</Text>
              <TextInput
                style={[
                  styles.input,
                  { height: 80, textAlignVertical: "top" },
                  isRestricted && styles.inputDisabled,
                ]}
                placeholder="Enter Description of Material"
                value={rmFormData.descriptionOfMaterial}
                onChangeText={(text) =>
                  updateRMField("descriptionOfMaterial", text)
                }
                multiline
                numberOfLines={3}
                editable={!isSubmitting && !isRestricted}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={[styles.input, isRestricted && styles.inputDisabled]}
                placeholder="Enter Quantity"
                value={rmFormData.quantity}
                onChangeText={(text) => updateRMField("quantity", text)}
                editable={!isSubmitting && !isRestricted}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
<TouchableOpacity
  style={[
    styles.button,
    styles.submitButton,
    (isSubmitting || isRestricted) && styles.buttonDisabled
  ]}
  onPress={
    isRestricted
      ? () => showAlert('Restricted Access', restrictedMessage)
      : handleRMSubmit
  }
  disabled={isSubmitting || isRestricted}
>
  {isSubmitting ? (
    <ActivityIndicator size="small" color="white" />
  ) : (
    <Text style={styles.buttonText}>
      {isRestricted ? 'View Only' : 'Submit RM Entry'}
    </Text>
  )}
</TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.clearButton,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleClearButtonPress}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {(isSearching || isSubmitting) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A651" />
          <Text style={styles.loadingText}>
            {isSearching
              ? "Searching documents..."
              : isSubmitting
              ? entryType === "RM"
                ? "Creating RM entry..."
                : "Submitting gate entries..."
              : ""}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default GateEntryTab;
