import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Scale, AlertTriangle, CreditCard, Ban, ShieldCheck, Gavel, Mail, Calendar } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background bg-mesh-subtle flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 mb-6">
            <Scale className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please read these terms carefully before using Applyn's services. By using our platform, you agree to be bound by these terms.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Last updated: January 20, 2026</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Agreement */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                1. Agreement to Terms
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                By accessing or using Applyn's website and services at applyn.co.in ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mt-4">
                These Terms apply to all visitors, users, and others who access or use the Service. By accessing or using the Service, you agree to be bound by these Terms. If you are using the Service on behalf of an organization, you are agreeing to these Terms for that organization.
              </p>
            </CardContent>
          </Card>

          {/* Description of Service */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Applyn provides a platform that allows users to convert websites into native mobile applications for Android and iOS platforms. Our services include:
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Website to Android APK/AAB conversion
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Website to iOS IPA conversion
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  App customization (icon, colors, splash screen)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  Push notification integration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  App Store and Play Store preparation assistance
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-400" />
                3. User Accounts
              </h2>
              <div className="space-y-4 text-muted-foreground text-sm">
                <p className="leading-relaxed">
                  When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms.
                </p>
                <p className="leading-relaxed">
                  You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
                </p>
                <p className="leading-relaxed">
                  You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-400" />
                4. Payment Terms
              </h2>
              <div className="space-y-4 text-muted-foreground text-sm">
                <div>
                  <h3 className="font-medium text-white mb-2">Pricing</h3>
                  <p className="leading-relaxed">
                    Our services are offered at the prices displayed on our pricing page. Prices are in Indian Rupees (INR) and are subject to change. We will notify users of any price changes in advance.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-2">Payment Processing</h3>
                  <p className="leading-relaxed">
                    All payments are processed securely through Razorpay. We accept various payment methods including credit cards, debit cards, UPI, and net banking.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-2">Refund Policy</h3>
                  <p className="leading-relaxed">
                    Due to the nature of our digital services, refunds are handled on a case-by-case basis. If you experience issues with your app build, please contact our support team within 7 days of purchase.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acceptable Use */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-400" />
                5. Acceptable Use Policy
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                You agree NOT to use Applyn to create apps that:
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Contain illegal, harmful, or offensive content
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Infringe on intellectual property rights of others
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Distribute malware, viruses, or malicious code
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Engage in phishing, fraud, or deceptive practices
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Violate any applicable laws or regulations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Promote violence, discrimination, or hate speech
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">✗</span>
                  Impersonate any person or entity
                </li>
              </ul>
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-xs">
                  We reserve the right to terminate accounts and refuse service to anyone who violates these terms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
              <div className="space-y-4 text-muted-foreground text-sm">
                <div>
                  <h3 className="font-medium text-white mb-2">Your Content</h3>
                  <p className="leading-relaxed">
                    You retain ownership of any content, websites, and intellectual property that you use with our Service. You grant us a limited license to access your website URL solely for the purpose of creating your mobile app.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-2">Our Content</h3>
                  <p className="leading-relaxed">
                    The Service and its original content (excluding content provided by users), features, and functionality are and will remain the exclusive property of Applyn and its licensors.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-2">Your Responsibility</h3>
                  <p className="leading-relaxed">
                    You are solely responsible for ensuring that you have the right to convert any website into a mobile app. You warrant that you own or have permission to use the website content.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                7. Disclaimer & Limitation of Liability
              </h2>
              <div className="space-y-4 text-muted-foreground text-sm">
                <p className="leading-relaxed">
                  THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. APPLYN MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE SERVICE'S RELIABILITY, AVAILABILITY, OR SUITABILITY FOR ANY PURPOSE.
                </p>
                <p className="leading-relaxed">
                  We do not guarantee that:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    Your app will be approved by the Apple App Store or Google Play Store
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    The Service will be uninterrupted, secure, or error-free
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    The apps will work on all devices or operating system versions
                  </li>
                </ul>
                <p className="leading-relaxed">
                  In no event shall Applyn be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Gavel className="h-5 w-5 text-blue-400" />
                8. Governing Law
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana, India.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">9. Termination</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mt-4">
                If you wish to terminate your account, you may simply discontinue using the Service or contact us to delete your account.
              </p>
            </CardContent>
          </Card>

          {/* Changes */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mt-4">
                By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="glass border-white/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-cyan-400" />
                11. Contact Us
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <p className="text-sm text-white">Email: <a href="mailto:legal@applyn.co.in" className="text-cyan-400 hover:underline">legal@applyn.co.in</a></p>
                <p className="text-sm text-white mt-2">Address: Hitech City, Hyderabad, Telangana, India</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
