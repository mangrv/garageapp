import Glyph from "@/app/components/Glyph";

type Feature = { icon: string; title: string; desc: string };

export default function FeatureGrid({ title, subtitle, features }: { title: string; subtitle?: string; features: Feature[] }) {
  return (
    <section className="px-5 py-14">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>
          {subtitle && <p className="text-gray-500 mt-2 text-base">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-card">
              <span className="w-11 h-11 rounded-xl bg-amber-900 text-amber-500 flex items-center justify-center">
                <Glyph e={f.icon} size={22} />
              </span>
              <h3 className="mt-4 font-semibold text-white text-lg">{f.title}</h3>
              <p className="mt-1.5 text-[15px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
