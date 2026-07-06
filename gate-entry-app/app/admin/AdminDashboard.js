// app/admin/AdminDashboard.js — RETIRED (July 2026).
//
// Admin Insights was merged into the gate dashboard (/security): one
// insights implementation for all roles. Admins land on the Insights tab
// there with warehouse/site filters and CSV export; Gate Entry is view-only.
//
// This route remains only as a redirect so old bookmarks and deep links
// don't break. AdminInsightsScreen is no longer imported anywhere and can
// be deleted once the merge has been verified in production.
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

const AdminDashboard = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/security');
  }, []);

  return null;
};

export default AdminDashboard;
