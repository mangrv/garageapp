import { Check } from "lucide-react";

export default function AboutSection() {
  return (
    <section className="px-5 py-14">
      <div className="max-w-3xl mx-auto space-y-5 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">A garage notebook with modern help</h2>
        <p className="text-gray-400 text-base leading-relaxed">
          GarageMeet is for everyday owners, weekend mechanics, families and small shops who want one trustworthy place for vehicles, projects, service records, receipts, warranties, documents and carefully chosen community posts.
        </p>
        <p className="text-gray-500 text-[15px] leading-relaxed">GarageMeet is owned and developed by <a href="https://iglesiastech.com/about" className="text-amber-500 font-medium underline underline-offset-4">Iglesias Tech LLC</a>.</p>
        <ul className="flex flex-wrap justify-center gap-2.5 pt-2">
          {["Private by default", "Receipt scanning", "Warranty reminders", "Project history", "Sharing controls"].map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5 bg-gray-900 border border-gray-700 px-3.5 h-9 rounded-full text-sm text-gray-300 font-medium">
              <Check size={15} className="text-emerald-500" /> {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
