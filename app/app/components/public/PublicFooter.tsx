export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-800 px-5 py-8 text-center text-xs text-gray-600">
      <p>© {new Date().getFullYear()} GarageMeet · Built for real garages, shared carefully.</p>
    </footer>
  );
}
