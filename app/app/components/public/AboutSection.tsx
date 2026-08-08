export default function AboutSection() {
  return (
    <section className="px-5 py-20">
      <div className="max-w-3xl mx-auto space-y-5 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">A garage notebook with modern help</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          GarageMeet is for everyday owners, weekend mechanics, families, and small shops who need one trustworthy place for vehicles, projects, service records, receipts, warranties, documents, and carefully chosen community posts.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {["Private by default", "Receipt scanning", "Warranty reminders", "Project history", "Social sharing controls"].map((item) => (
            <span key={item} className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-full text-xs text-gray-300 font-medium">{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
