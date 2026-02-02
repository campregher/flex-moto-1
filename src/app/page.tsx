import Link from 'next/link'
import { HiOutlineTruck, HiOutlineShoppingBag, HiOutlineLocationMarker, HiOutlineCurrencyDollar } from 'react-icons/hi'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Flex Entregas
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-4">
              Mercado Livre Flex + Shopee Entrega Direta
            </p>
            <p className="text-lg text-primary-200 max-w-2xl mx-auto mb-10">
              Conectamos lojistas e entregadores para entregas urbanas rápidas e seguras com motos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="btn bg-white text-primary-700 hover:bg-gray-100 px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="btn bg-primary-500 text-white border-2 border-white/30 hover:bg-primary-400 px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Cadastre-se
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o Flex?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Uma plataforma completa para gerenciar suas entregas de forma eficiente
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: HiOutlineTruck,
                title: 'Entregadores Verificados',
                description: 'Todos os entregadores passam por validação de documentos',
              },
              {
                icon: HiOutlineLocationMarker,
                title: 'Rastreamento em Tempo Real',
                description: 'Acompanhe sua entrega no mapa em tempo real',
              },
              {
                icon: HiOutlineCurrencyDollar,
                title: 'Preços Transparentes',
                description: 'Cálculo automático baseado em distância e pacotes',
              },
              {
                icon: HiOutlineShoppingBag,
                title: 'Multi-plataforma',
                description: 'Suporte para Mercado Livre Flex e Shopee',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="text-center p-6"
              >
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Lojista CTA */}
            <div className="card p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-mercadolivre rounded-xl flex items-center justify-center">
                  <HiOutlineShoppingBag className="w-6 h-6 text-gray-900" />
                </div>
                <div className="w-12 h-12 bg-shopee rounded-xl flex items-center justify-center">
                  <HiOutlineShoppingBag className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Sou Lojista
              </h3>
              <p className="text-gray-600 mb-6">
                Cadastre-se e comece a enviar suas encomendas do Mercado Livre Flex e Shopee com entregadores verificados.
              </p>
              <Link
                href="/cadastro?tipo=lojista"
                className="btn-primary w-full"
              >
                Cadastrar como Lojista
              </Link>
            </div>

            {/* Entregador CTA */}
            <div className="card p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                  <HiOutlineTruck className="w-6 h-6 text-secondary-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Sou Entregador
              </h3>
              <p className="text-gray-600 mb-6">
                Ganhe dinheiro fazendo entregas com sua moto. Horários flexíveis e pagamento garantido.
              </p>
              <Link
                href="/cadastro?tipo=entregador"
                className="btn-secondary w-full"
              >
                Cadastrar como Entregador
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h4 className="text-2xl font-bold mb-2">Flex Entregas</h4>
            <p className="text-gray-400 mb-4">
              Entregas urbanas com motos
            </p>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Flex Entregas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
