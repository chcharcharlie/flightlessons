import React from 'react'
import { Link } from 'react-router-dom'

export const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <Link to="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
          FirstSolo
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: March 10, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FirstSolo ("the Service") at <strong>firstsolo.app</strong>, you agree
              to be bound by these Terms of Service. If you do not agree to these terms, please do not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              FirstSolo is a flight training management platform that helps Certified Flight Instructors
              (CFIs) manage student training programs, schedule lessons, track progress, and communicate
              with students. Students use FirstSolo to access their training materials, track their
              progress, and prepare for checkrides.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must be at least 13 years old to use the Service.</li>
              <li>One person or entity may not maintain more than one account without our permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. CFI Responsibilities</h2>
            <p className="mb-3">
              As a Certified Flight Instructor using FirstSolo, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You hold a valid FAA CFI certificate (or equivalent) and are responsible for ensuring your credentials remain current.</li>
              <li>FirstSolo is a training management tool, not a substitute for proper flight instruction, ground training, or regulatory compliance.</li>
              <li>You are solely responsible for the accuracy of training records, endorsements, and progress assessments you enter.</li>
              <li>All flight training activities must comply with applicable FAA regulations (14 CFR) and other applicable laws.</li>
              <li>You will not use FirstSolo to falsify training records or endorsements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Student Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You acknowledge that AI-powered study assistance is for educational purposes only and does not replace instruction from a qualified CFI.</li>
              <li>Always verify regulatory information with official FAA sources (FAR, AIM, ACS).</li>
              <li>You are responsible for your own flight safety and adherence to applicable regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li>Enter false, misleading, or fraudulent training records.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Use the Service to transmit spam, malware, or harmful content.</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. AI Features</h2>
            <p>
              FirstSolo includes AI-powered study assistance that references FAA regulations and training
              materials. While we strive for accuracy, AI-generated content may contain errors or
              inaccuracies. Always verify critical information with official FAA sources. AI assistance
              is not a substitute for qualified flight instruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              The FirstSolo platform, including its design, code, and content created by us, is owned by
              FirstSolo and protected by applicable intellectual property laws. Training content and records
              you create remain yours. You grant us a limited license to store and display your content
              solely for the purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimers</h2>
            <p className="mb-3">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The Service will be uninterrupted or error-free.</li>
              <li>AI-generated content is accurate, complete, or suitable for any specific purpose.</li>
              <li>The Service will meet your specific training or regulatory requirements.</li>
            </ul>
            <p className="mt-3">
              FirstSolo is not an FAA-approved training provider and does not issue official endorsements
              or certificates. All official aviation training records must comply with applicable FAA
              regulations independent of this platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FIRSTSOLO SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
              LOSS OF DATA, LOSS OF PROFITS, OR ANY DAMAGES RELATED TO FLIGHT TRAINING DECISIONS MADE
              IN RELIANCE ON THIS SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at our discretion if you violate
              these Terms. You may terminate your account at any time by contacting us. Upon termination,
              your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify users of material changes by
              updating the "Last updated" date above. Continued use of the Service after changes
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of California, without regard to its
              conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact</h2>
            <p>
              Questions about these Terms? Contact us at:{' '}
              <a href="mailto:ccehshmily@gmail.com" className="text-blue-600 hover:underline">
                ccehshmily@gmail.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-6 text-sm text-gray-500">
          <Link to="/privacy" className="hover:text-gray-700">Privacy Policy</Link>
          <Link to="/" className="hover:text-gray-700">Back to FirstSolo</Link>
        </div>
      </div>
    </div>
  )
}
