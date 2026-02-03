export const dynamic = 'force-dynamic'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-600 mt-2">
            Painel administrativo básico. Em breve: relatórios, taxas e gestão de usuários.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          <ul className="mt-3 text-sm text-gray-600 space-y-2">
            <li>• Login de admin ativo</li>
            <li>• Redirecionamento para /admin configurado</li>
            <li>• Proteção de rota via middleware</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
