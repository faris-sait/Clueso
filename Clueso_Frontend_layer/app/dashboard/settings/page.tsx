'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function SettingsPage() {
  const { user } = useUser();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user has a password (not OAuth-only user)
  const hasPassword = user?.passwordEnabled || false;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Update password using Clerk
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });

      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Profile</h1>
            <p className="text-xs text-gray-400">Customize your personal profile</p>
          </div>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="mb-8">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName || 'Profile'}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold">
            {user?.firstName?.charAt(0)?.toUpperCase() || user?.emailAddresses?.[0]?.emailAddress?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>

      {/* Account Settings - Two Column Layout */}
      <div className="space-y-6">
        {/* Name */}
        <div className="grid grid-cols-[200px_1fr] gap-8 items-center">
          <label className="text-sm font-medium text-white">Name</label>
          <input
            type="text"
            value={user?.fullName || user?.firstName || ''}
            readOnly
            className="bg-[#1a1a24] border border-gray-700 rounded-lg py-2.5 px-4 text-gray-400 text-sm cursor-not-allowed"
          />
        </div>

        {/* Email */}
        <div className="grid grid-cols-[200px_1fr] gap-8 items-center">
          <label className="text-sm font-medium text-white">Email</label>
          <input
            type="email"
            value={user?.emailAddresses?.[0]?.emailAddress || ''}
            readOnly
            className="bg-[#1a1a24] border border-gray-700 rounded-lg py-2.5 px-4 text-gray-400 text-sm cursor-not-allowed"
          />
        </div>

        {/* Password - Only show if user has password enabled */}
        {hasPassword && (
          <div className="grid grid-cols-[200px_1fr] gap-8 items-center">
            <label className="text-sm font-medium text-white">Password</label>
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors text-left"
            >
              Change Password
            </button>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a24] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Change Password</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setError('');
                  setSuccess('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 text-sm text-green-500">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#13131a] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#13131a] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#13131a] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setError('');
                    setSuccess('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
