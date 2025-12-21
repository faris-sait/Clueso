'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 font-sans p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎬</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Join Clueso
          </h1>
          <p className="text-gray-600">
            Create your account to get started
          </p>
        </div>
        
        <SignUp 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-white shadow-2xl rounded-2xl border border-gray-200",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium rounded-xl py-3 transition-all",
              socialButtonsBlockButtonText: "font-medium text-gray-700",
              formButtonPrimary: "bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl",
              formFieldInput: "border-2 border-gray-200 rounded-xl py-3 px-4 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all",
              formFieldLabel: "text-gray-700 font-medium mb-2",
              footerActionLink: "text-pink-600 hover:text-pink-700 font-medium",
              identityPreviewText: "text-gray-700",
              identityPreviewEditButton: "text-pink-600 hover:text-pink-700",
              formResendCodeLink: "text-pink-600 hover:text-pink-700",
              otpCodeFieldInput: "border-2 border-gray-200 rounded-xl focus:border-pink-500",
              formFieldInputShowPasswordButton: "text-gray-500 hover:text-gray-700",
            },
            layout: {
              socialButtonsPlacement: "top",
              socialButtonsVariant: "blockButton",
            },
          }}
        />
      </div>
    </div>
  );
}
