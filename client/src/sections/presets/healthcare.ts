import type { AppBlueprint, ThemePresetId } from "@shared/blueprints";

type HealthcareVariant = "default" | "dental";

function detectHealthcareVariant(prompt: string): HealthcareVariant {
  const p = String(prompt || "").toLowerCase();
  if (p.includes("dental") || p.includes("dentist") || p.includes("orthodont")) return "dental";
  return "default";
}

export function buildHealthcareBlueprint(args: { appName: string; prompt?: string }): AppBlueprint {
  const variant = detectHealthcareVariant(args.prompt || "");
  const appName = args.appName || "Clinic";
  const theme: ThemePresetId = "healthcare-calm";

  const doctors =
    variant === "dental"
      ? [
          {
            id: "d1",
            name: "Dr. Mia Chen",
            price: "Dentist",
            image: { kind: "keyword" as const, keyword: "dentist portrait", w: 700, orientation: "squarish" as const },
            rating: 4.9,
            desc: "Cleanings • Cosmetic",
            action: "action:doctor_d1",
          },
          {
            id: "d2",
            name: "Dr. Liam Singh",
            price: "Orthodontist",
            image: { kind: "keyword" as const, keyword: "orthodontist portrait", w: 700, orientation: "squarish" as const },
            rating: 4.8,
            desc: "Braces • Aligners",
            action: "action:doctor_d2",
          },
          {
            id: "d3",
            name: "Dr. Sofia Reyes",
            price: "Hygienist",
            image: { kind: "keyword" as const, keyword: "dental hygienist portrait", w: 700, orientation: "squarish" as const },
            rating: 4.7,
            desc: "Preventive care",
            action: "action:doctor_d3",
          },
        ]
      : [
          {
            id: "d1",
            name: "Dr. Emma Brown",
            price: "General Physician",
            image: { kind: "keyword" as const, keyword: "doctor portrait", w: 700, orientation: "squarish" as const },
            rating: 4.9,
            desc: "Primary care • Wellness",
            action: "action:doctor_d1",
          },
          {
            id: "d2",
            name: "Dr. Oliver Khan",
            price: "Cardiologist",
            image: { kind: "keyword" as const, keyword: "cardiologist portrait", w: 700, orientation: "squarish" as const },
            rating: 4.8,
            desc: "Heart health • ECG",
            action: "action:doctor_d2",
          },
          {
            id: "d3",
            name: "Dr. Ava Johnson",
            price: "Dermatologist",
            image: { kind: "keyword" as const, keyword: "dermatologist portrait", w: 700, orientation: "squarish" as const },
            rating: 4.7,
            desc: "Skin care • Acne",
            action: "action:doctor_d3",
          },
          {
            id: "d4",
            name: "Dr. Noah Williams",
            price: "Pediatrician",
            image: { kind: "keyword" as const, keyword: "pediatrician portrait", w: 700, orientation: "squarish" as const },
            rating: 4.8,
            desc: "Kids • Vaccines",
            action: "action:doctor_d4",
          },
        ];

  const appointments = [
    { id: "ap1", title: "Appointment", subtitle: "Tomorrow • 10:30 AM", total: "30 min", status: "Booked" },
    { id: "ap2", title: "Follow-up", subtitle: "Next week • 3:00 PM", total: "20 min", status: "Booked" },
  ];

  return {
    version: "1",
    appName,
    businessType: "healthcare",
    theme,
    screens: [
      {
        id: "home",
        name: "Home",
        icon: "🏥",
        isHome: true,
        sections: [
          {
            id: "hero",
            type: "hero",
            title: appName,
            subtitle: variant === "dental" ? "Care for your smile, start here" : "Care you can trust, anytime",
            ctaText: "Book appointment",
            ctaAction: "navigate:appointments",
            background: { kind: "keyword", keyword: variant === "dental" ? "dental clinic reception" : "modern clinic reception", w: 1200, orientation: "landscape" },
            overlay: "rgba(0,0,0,0.35)",
          },
          {
            id: "services",
            type: "categoryGrid",
            title: "Services",
            columns: 3,
            categories:
              variant === "dental"
                ? [
                    { id: "c1", title: "Cleaning", icon: "🪥", action: "navigate:appointments" },
                    { id: "c2", title: "Whitening", icon: "✨", action: "navigate:appointments" },
                    { id: "c3", title: "Braces", icon: "🦷", action: "navigate:appointments" },
                  ]
                : [
                    { id: "c1", title: "Doctors", icon: "🧑‍⚕️", action: "navigate:doctors" },
                    { id: "c2", title: "Appointments", icon: "📅", action: "navigate:appointments" },
                    { id: "c3", title: "Records", icon: "📄", action: "navigate:records" },
                  ],
          },
          { id: "doctors", type: "productGrid", title: "Available doctors", columns: 2, products: doctors.slice(0, 4) },
        ],
      },
      {
        id: "doctors",
        name: "Doctors",
        icon: "🧑‍⚕️",
        sections: [
          { id: "search", type: "searchBar", placeholder: "Search doctors…" },
          { id: "filters", type: "filterChips", chips: variant === "dental" ? ["All", "Dentist", "Ortho", "Hygiene"] : ["All", "GP", "Cardio", "Derm", "Peds"] },
          { id: "grid", type: "productGrid", title: "Doctors", columns: 2, products: doctors },
        ],
      },
      {
        id: "appointments",
        name: "Appointments",
        icon: "📅",
        sections: [
          {
            id: "cta",
            type: "hero",
            title: "Your appointments",
            subtitle: "Manage bookings and reminders",
            ctaText: "New booking",
            ctaAction: "action:new_appointment",
            background: { kind: "keyword", keyword: "calendar appointment booking", w: 1200, orientation: "landscape" },
            overlay: "rgba(0,0,0,0.35)",
          },
          { id: "list", type: "orderList", items: appointments },
        ],
      },
      {
        id: "records",
        name: "Records",
        icon: "📄",
        sections: [
          {
            id: "menu",
            type: "accountMenu",
            items: [
              { id: "r1", label: "Lab results", icon: "🧪", action: "action:lab_results" },
              { id: "r2", label: "Prescriptions", icon: "💊", action: "action:prescriptions" },
              { id: "r3", label: "Vaccinations", icon: "💉", action: "action:vaccines" },
            ],
          },
        ],
      },
      {
        id: "profile",
        name: "Profile",
        icon: "👤",
        sections: [
          {
            id: "menu",
            type: "accountMenu",
            items: [
              { id: "p1", label: "Personal info", icon: "🪪", action: "action:profile" },
              { id: "p2", label: "Insurance", icon: "🧾", action: "action:insurance" },
              { id: "p3", label: "Notifications", icon: "🔔", action: "action:notifications" },
              { id: "p4", label: "Support", icon: "💬", action: "action:support" },
            ],
          },
        ],
      },
    ],
  };
}
