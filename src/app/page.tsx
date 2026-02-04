import Link from 'next/link'
import { Truck, ShoppingBag, MapPin, DollarSign } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[#0D0D0D] text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#0DD9C4]/30 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-[#025959]/40 blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs uppercase tracking-[0.2em]">
              Agilidade urbana
            </p>
            <h1 className="mt-6 text-4xl md:text-6xl font-bold font-display">
              Flex Moto
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mt-4 whitespace-normal break-words leading-relaxed">
              Mercado Livre Flex + Shopee Entrega Direta
            </p>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mt-6 whitespace-normal break-words leading-relaxed">
              Conectamos lojistas e entregadores para entregas urbanas rápidas, confiáveis e com mobilidade total.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="btn bg-[#0DD9C4] text-[#0D0D0D] hover:bg-[#0CF2DB] px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="btn border-2 border-white/30 text-white hover:bg-white/10 px-8 py-3 text-lg font-semibold rounded-xl"
              >
                Cadastre-se
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { label: 'Entregas rápidas', value: '20min' },
                { label: 'Cobertura urbana', value: '24h' },
                { label: 'Rotas otimizadas', value: 'IA' },
                { label: 'Pagamentos seguros', value: 'PIX' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-xs text-white/70 mt-1 whitespace-normal break-words">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-transparent py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-display">
              Por que escolher o Flex Moto
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto whitespace-normal break-words leading-relaxed">
              UX simples, rastreio preciso e operação pronta para escala.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Truck,
                title: 'Entregadores Verificados',
                description: 'Cadastro e verificação completa para manter qualidade e segurança.',
              },
              {
                icon: MapPin,
                title: 'Rastreamento em Tempo Real',
                description: 'Acompanhe rota e status com atualizações instantâneas.',
              },
              {
                icon: DollarSign,
                title: 'Preços Transparentes',
                description: 'Cálculo automático por distância, pacotes e prioridade.',
              },
              {
                icon: ShoppingBag,
                title: 'Multi-plataforma',
                description: 'Integração com Mercado Livre Flex e Shopee Direta.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="text-center p-6 rounded-2xl bg-white/80 backdrop-blur border border-gray-200"
              >
                <div className="w-16 h-16 bg-[#0DD9C4]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-[#025959]" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 font-display">
                  {feature.title}
                </h3>
                <p className="text-gray-600 whitespace-normal break-words leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-transparent py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Lojista CTA */}
            <div className="card p-8 hover:shadow-lg transition-shadow border-[#0DD9C4]/30 flex flex-col text-center h-full">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 bg-mercadolivre rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-gray-900" />
                </div>
                <div className="w-12 h-12 bg-shopee rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 font-display">
                Sou Lojista
              </h3>
              <p className="text-gray-600 mb-6 whitespace-normal break-words leading-relaxed">
                Cadastre-se e envie seus pedidos com agilidade, segurança e controle total.
              </p>
              <Link
                href="/cadastro?tipo=lojista"
                className="btn-primary w-full mt-auto"
              >
                Cadastrar como Lojista
              </Link>
            </div>

            {/* Entregador CTA */}
            <div className="card p-8 hover:shadow-lg transition-shadow border-[#025959]/30 flex flex-col text-center h-full">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[#025959]/10 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-[#025959]" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 font-display">
                Sou Entregador
              </h3>
              <p className="text-gray-600 mb-6 whitespace-normal break-words leading-relaxed">
                Ganhe com rotas inteligentes, repasse rápido e operação transparente.
              </p>
              <Link
                href="/cadastro?tipo=entregador"
                className="btn-secondary w-full mt-auto"
              >
                Cadastrar como Entregador
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0D0D0D] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h4 className="text-2xl font-bold mb-2 font-display">Flex Moto</h4>
            <p className="text-white/70 mb-4 whitespace-normal break-words leading-relaxed">
              Entregas urbanas com motos
            </p>
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} Flex Moto. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
