import type { UserDetails } from '../types';

// This declaration is necessary for TypeScript to recognize the PaystackPop object
// that is loaded from the script tag in index.html.
declare const PaystackPop: any;

/**
 * Initiates the Paystack Inline Popup for subscriptions.
 * This method shows a popup on the site and allows users to choose their payment method (Card, MoMo, etc.).
 * It correctly handles subscriptions by providing both the plan code and the initial amount.
 *
 * @param planType 'monthly' or 'yearly'
 * @param userDetails The current user's details, used to pre-fill email
 */
export const redirectToCheckout = (planType: 'monthly' | 'yearly', userDetails: UserDetails | null): void => {
  
  // --- LIVE KEYS AND PLAN CODES ---
  const publicKey = "pk_live_fc06914c2c72615986c6a26aad1c7e7acb277b9b";
  // These are the latest plan codes associated with the Payment Pages, ensuring consistency.
  const monthlyPlanCode = "PLN_l3m69cx0glc374g";
  const yearlyPlanCode = "PLN_554m9qadwtfhbdd";
  
  const planCode = planType === 'yearly' ? yearlyPlanCode : monthlyPlanCode;

  // The amount must be in the smallest currency unit. For GHS, this is pesewas (100 pesewas = 1 GHS).
  // GHS 21.80 -> 2180 pesewas
  // GHS 218.00 -> 21800 pesewas
  const amountInPesewas = planType === 'yearly' ? 21800 : 2180;

  if (!userDetails?.email) {
    alert("Please log in to subscribe");
    return;
  }

  const handler = PaystackPop.setup({
    key: publicKey,
    email: userDetails.email,
    amount: amountInPesewas, // This is crucial for showing all payment options
    plan: planCode,          // This links the payment to a subscription plan
    currency: 'GHS',
    
    // Explicitly request all desired payment channels
    channels: ['card', 'mobile_money', 'bank', 'ussd', 'qr'],
    
    // Generate a unique reference for each transaction for tracking
    ref: `edublay-${userDetails.id}-${Date.now()}`,
    
    // This function is called after a successful payment
    callback: function(response: any) {
      // Redirect back to the app with success parameters.
      // The main App component will handle these parameters to update the user's status.
      window.location.href = `${window.location.origin}${window.location.pathname}?payment_status=success&trxref=${response.trxref}&reference=${response.reference}`;
    },
    
    // This function is called when the user closes the popup
    onClose: function() {
      console.log('Payment popup closed by user.');
    },
  });

  // Open the Paystack popup
  handler.openIframe();
};