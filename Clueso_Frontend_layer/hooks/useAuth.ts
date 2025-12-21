'use client';

import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';

export function useAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useClerkAuth();

  return {
    isLoaded,
    isSignedIn,
    user,
    getToken,
    signOut,
    userId: user?.id,
    email: user?.primaryEmailAddress?.emailAddress,
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: user?.fullName,
  };
}
