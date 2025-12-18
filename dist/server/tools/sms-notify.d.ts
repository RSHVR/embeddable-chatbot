/**
 * SMS Notify Tool for Twilio Integration
 *
 * Allows the chatbot agent to send SMS messages to the business owner
 * and receive responses for two-way communication.
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 * - OWNER_PHONE_NUMBER
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
/**
 * Tool definition for Claude to notify the business owner via SMS
 */
export declare const smsNotifyOwnerTool: Tool;
export interface SMSToolInput {
    message: string;
    context_summary?: string;
}
export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    toNumber: string;
}
/**
 * Send an SMS via Twilio REST API (no SDK dependency)
 */
export declare function sendSMS(config: TwilioConfig, message: string): Promise<{
    success: boolean;
    sid?: string;
    error?: string;
}>;
/**
 * Execute the SMS notify tool
 */
export declare function executeSMSTool(input: SMSToolInput, config: TwilioConfig): Promise<string>;
/**
 * Validate Twilio webhook signature
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export declare function validateTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): Promise<boolean>;
/**
 * Parse Twilio webhook body (application/x-www-form-urlencoded)
 */
export declare function parseTwilioWebhook(body: string): Record<string, string>;
