import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Eye, Lock, Database, Globe, Mail, Calendar, FileText } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 mb-6">
            <Shield className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how Applyn collects, uses, and protects your personal information.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Last updated: January 20, 2026</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Introduction */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to Applyn ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services at applyn.co.in.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access our services.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-400" />
                Information We Collect
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-white mb-2">Personal Information</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    When you register for an account, we collect:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
                    <li>Email address</li>
                    <li>Full name</li>
                    <li>Password (encrypted)</li>
                    <li>Google account information (if you sign in with Google)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-white mb-2">App Creation Data</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    When you create an app, we collect:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
                    <li>Website URLs you want to convert</li>
                    <li>App name and icon preferences</li>
                    <li>Branding colors and customization settings</li>
                    <li>Platform preferences (Android/iOS)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-white mb-2">Payment Information</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Payment processing is handled by Razorpay. We do not store your credit/debit card details. We only receive transaction confirmations and payment IDs from Razorpay.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-white mb-2">Automatically Collected Information</h3>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                    <li>IP address and browser type</li>
                    <li>Device information</li>
                    <li>Usage data and analytics</li>
                    <li>Cookies and similar technologies</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-400" />
                How We Use Your Information
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Provide, maintain, and improve our services
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Process your app creation requests and payments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Send you technical notices, updates, and support messages
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Respond to your comments, questions, and customer service requests
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Monitor and analyze trends, usage, and activities
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Detect, investigate, and prevent fraudulent transactions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Personalize and improve your experience
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-yellow-400" />
                Data Security
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information, including:
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm mt-4">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  SSL/TLS encryption for all data transmission
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  Secure password hashing using industry-standard algorithms
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  Regular security audits and vulnerability assessments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  Access controls limiting employee access to personal data
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  Secure cloud infrastructure with data backups
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Sharing */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Data Sharing & Third Parties
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="space-y-3 text-muted-foreground text-sm">
                <li>
                  <span className="font-medium text-white">Service Providers:</span> We share data with trusted third parties who help us operate our platform (e.g., Razorpay for payments, cloud hosting providers).
                </li>
                <li>
                  <span className="font-medium text-white">Legal Requirements:</span> We may disclose information if required by law or in response to valid legal requests.
                </li>
                <li>
                  <span className="font-medium text-white">Business Transfers:</span> If we are involved in a merger or acquisition, your information may be transferred as part of that transaction.
                </li>
                <li>
                  <span className="font-medium text-white">With Your Consent:</span> We may share information for other purposes with your explicit consent.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Your Rights</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                You have the following rights regarding your personal data:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="font-medium text-white mb-1">Access</h4>
                  <p className="text-muted-foreground text-xs">Request a copy of your personal data</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="font-medium text-white mb-1">Correction</h4>
                  <p className="text-muted-foreground text-xs">Update or correct your information</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="font-medium text-white mb-1">Deletion</h4>
                  <p className="text-muted-foreground text-xs">Request deletion of your account</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="font-medium text-white mb-1">Portability</h4>
                  <p className="text-muted-foreground text-xs">Export your data in a common format</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cookies */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Cookies & Tracking</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our service and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mt-4">
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-cyan-400" />
                Contact Us
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <p className="text-sm text-white">Email: <a href="mailto:privacy@applyn.co.in" className="text-cyan-400 hover:underline">privacy@applyn.co.in</a></p>
                <p className="text-sm text-white mt-2">Address: Hitech City, Hyderabad, Telangana, India</p>
              </div>
            </CardContent>
          </Card>

          {/* Changes */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Changes to This Policy</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top of this policy.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mt-4">
                You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
