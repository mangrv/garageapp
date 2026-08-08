type Feature = { icon: string; title: string; desc: string };

export default function FeatureGrid({ title, subtitle, features }: { title: string; subtitle?: string; features: Feature[] }) {
  return (
    <section className="px-5 py-10 bg-gray-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>
          {subtitle && <p className="text-gray-500 mt-2 text-sm">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-2 hover:border-amber-500/30 transition-colors">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-bold text-white text-sm">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
