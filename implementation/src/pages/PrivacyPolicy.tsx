import React from 'react'
import { Link } from 'react-router-dom'

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <Link to="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
          FirstSolo
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: March 10, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              FirstSolo ("we," "our," or "us") operates the FirstSolo flight training management platform
              available at <strong>firstsolo.app</strong>. This Privacy Policy explains how we collect,
              use, and protect your personal information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account information:</strong> Name and email address provided at registration.</li>
              <li><strong>Training records:</strong> Lesson schedules, completion dates, scores, instructor notes, and progress data entered by CFIs and students.</li>
              <li><strong>Communications:</strong> Questions submitted to instructors and responses within the platform.</li>
              <li><strong>Calendar data:</strong> If you connect Google Calendar, we store OAuth tokens to create and manage calendar events on your behalf. We access only your calendar events — we do not read your existing calendar data.</li>
              <li><strong>Usage data:</strong> Standard log data such as access timestamps and browser type, used for debugging and service improvement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and operate the FirstSolo service.</li>
              <li>To sync lesson schedules to your connected calendar.</li>
              <li>To enable communication between flight instructors (CFIs) and students.</li>
              <li>To track training progress and generate progress reports.</li>
              <li>To improve and debug the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing</h2>
            <p className="mb-3">We do not sell your personal information. We share data only in these limited circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Between CFI and student:</strong> Training records are shared between the instructor and their enrolled students as part of the core service.</li>
              <li><strong>Service providers:</strong> We use Google Firebase for data storage and authentication, and Anthropic for AI-powered tutoring features. These providers process data only as necessary to provide their services.</li>
              <li><strong>Legal requirements:</strong> We may disclose data if required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Google Calendar Integration</h2>
            <p>
              When you connect Google Calendar, we request permission to create and manage calendar events
              on your behalf (<code className="bg-gray-100 px-1 rounded text-sm">calendar.events</code> scope).
              We use this access solely to add, update, or remove FirstSolo lesson events. We do not read,
              store, or share your existing calendar content. You can disconnect Google Calendar at any time
              from Settings, which will revoke our access.
            </p>
            <p className="mt-3">
              FirstSolo's use of information received from Google APIs adheres to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy"
                 className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. You may request deletion of your
              account and associated data by contacting us at the email below. After deletion, data is
              removed within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Security</h2>
            <p>
              We use industry-standard security measures including encrypted data transmission (HTTPS),
              Firebase Security Rules for access control, and Google Cloud Secret Manager for storing
              sensitive credentials. No method of transmission over the internet is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
            <p>
              FirstSolo is not directed at children under 13. We do not knowingly collect personal
              information from children under 13. If you believe we have inadvertently collected such
              information, please contact us to have it removed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant
              changes by updating the "Last updated" date above. Continued use of the service after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your personal data, please contact us at:{' '}
              <a href="mailto:ccehshmily@gmail.com" className="text-blue-600 hover:underline">
                ccehshmily@gmail.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-6 text-sm text-gray-500">
          <Link to="/tos" className="hover:text-gray-700">Terms of Service</Link>
          <Link to="/" className="hover:text-gray-700">Back to FirstSolo</Link>
        </div>
      </div>
    </div>
  )
}
