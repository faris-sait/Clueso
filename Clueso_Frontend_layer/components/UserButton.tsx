'use client';

import { UserButton as ClerkUserButton, useUser } from '@clerk/nextjs';

export default function UserButton() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-700">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="text-xs text-gray-500">
          {user?.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <ClerkUserButton 
        appearance={{
          elements: {
            avatarBox: "w-10 h-10 border-2 border-purple-200 hover:border-purple-400 transition-all",
            userButtonPopoverCard: "shadow-2xl border border-gray-200",
            userButtonPopoverActionButton: "hover:bg-purple-50",
            userButtonPopoverActionButtonText: "text-gray-700",
            userButtonPopoverFooter: "hidden",
          },
        }}
      />
    </div>
  );
}
