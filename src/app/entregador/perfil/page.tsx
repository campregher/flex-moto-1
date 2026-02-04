'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, Rating, StatusBadge } from '@/components/ui'
import { formatCPF, formatPhone, formatCurrency } from '@/lib/utils'
import { validateWhatsApp } from '@/lib/utils/validators'
import toast from 'react-hot-toast'
import {
  Mail,
  Phone,
  IdCard,
  MapPin,
  Truck,
  Pencil,
  Image as ImageIcon,
  Save,
  X,
} from 'lucide-react'

export default function EntregadorPerfilPage() {
  const { user, profile, setUser, setProfile } = useAuthStore()
  const entregadorProfile = (profile as any) || {}
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState(entregadorProfile?.foto_url || '')

  useEffect(() => {
    setEmail(user?.email || '')
    setWhatsapp(user?.whatsapp || '')
  }, [user?.email, user?.whatsapp])

  useEffect(() => {
    setFotoPreview(entregadorProfile?.foto_url || '')
  }, [entregadorProfile?.foto_url])

  const handleFotoChange = (file: File | null) => {
    setFotoFile(file)
    if (!file) {
      setFotoPreview(entregadorProfile?.foto_url || '')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoPreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const getExtFromMime = (mime: string) => {
    if (mime === 'image/jpeg') return 'jpg'
    if (mime === 'image/png') return 'png'
    if (mime === 'image/webp') return 'webp'
    return null
  }

  async function handleSaveProfile() {
    if (!user || !entregadorProfile?.id) return

    const cleanPhone = whatsapp.replace(/\D/g, '')
    if (!validateWhatsApp(cleanPhone)) {
      toast.error('Informe um WhatsApp valido')
      return
    }

    setSaving(true)
    try {
      let fotoUrl = entregadorProfile.foto_url

      if (fotoFile) {
        if (!fotoFile.size) {
          toast.error('Arquivo de foto invalido')
          return
        }

        const ext = getExtFromMime(fotoFile.type) || fotoFile.name.split('.').pop() || 'jpg'
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase())) {
          toast.error('Formato de imagem nao suportado. Use JPG, PNG ou WEBP.')
          return
        }

        const contentType = fotoFile.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')
        const filePath = `entregadores/${user.id}/perfil.${ext === 'jpeg' ? 'jpg' : ext}`

        const { error: uploadError } = await supabase.storage
          .from('fotos')
          .upload(filePath, fotoFile, { upsert: true, contentType })

        if (uploadError) {
          toast.error(uploadError.message || 'Erro ao enviar foto')
          return
        }

        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(filePath)
        fotoUrl = urlData.publicUrl || filePath

        const { error: fotoError } = await supabase
          .from('entregadores')
          .update({ foto_url: fotoUrl })
          .eq('id', entregadorProfile.id)

        if (fotoError) throw fotoError
      }

      if (email && email !== user.email) {
        const { error: authEmailError } = await supabase.auth.updateUser({ email })
        if (authEmailError) {
          toast.error(authEmailError.message || 'Erro ao atualizar email')
          return
        }
      }

      const { error: userError } = await supabase
        .from('users')
        .update({ email: email || user.email, whatsapp: cleanPhone })
        .eq('id', user.id)

      if (userError) throw userError

      setProfile({ ...entregadorProfile, foto_url: fotoUrl })
      setUser({ ...user, email: email || user.email, whatsapp: cleanPhone })
      toast.success('Perfil atualizado!')
      setEditing(false)
      setFotoFile(null)
    } catch (err) {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <button
          onClick={() => setEditing((prev) => !prev)}
          className="btn-ghost text-secondary-600"
        >
          {editing ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
        </button>
      </div>

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Avatar src={fotoPreview || entregadorProfile?.foto_url || null} name={user?.nome || ''} size="xl" className="" />
            {entregadorProfile?.online && (
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.nome || ''}</h2>
            <div className="flex items-center gap-2">
              <p className="text-gray-500">Entregador</p>
              <StatusBadge status={user?.status || 'pendente'} size="sm" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Rating
                value={entregadorProfile?.avaliacao_media || 5}
                size="sm"
                max={5}
                showValue={false}
                onChange={() => {}}
              />
              <span className="text-sm text-gray-500">
                ({entregadorProfile?.total_avaliacoes || 0} avaliacoes)
              </span>
            </div>
          </div>
        </div>

        {editing && (
          <div className="grid gap-4 mb-6">
            <div>
              <label className="label">Foto de perfil</label>
              <div className="flex items-center gap-3">
                <label className="btn-outline cursor-pointer">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Selecionar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFotoChange(e.target.files?.[0] || null)}
                  />
                </label>
                {fotoFile && (
                  <span className="text-sm text-gray-600 truncate">{fotoFile.name}</span>
                )}
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="label">WhatsApp</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="input"
                placeholder="(11) 99999-9999"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        )}

        <div className="grid gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user?.email || ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">WhatsApp</p>
              <p className="font-medium text-gray-900">{formatPhone(user?.whatsapp || '')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IdCard className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">CPF</p>
              <p className="font-medium text-gray-900">{formatCPF(user?.cpf || '')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Veiculo</h3>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Truck className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="font-medium text-gray-900 capitalize">{entregadorProfile?.tipo_veiculo}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold text-xs">
              PL
            </div>
            <div>
              <p className="text-sm text-gray-500">Placa</p>
              <p className="font-medium text-gray-900 font-mono">{entregadorProfile?.placa}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Cidade</p>
              <p className="font-medium text-gray-900">
                {entregadorProfile?.cidade} - {entregadorProfile?.uf}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Estatisticas</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">{entregadorProfile?.total_entregas || 0}</p>
            <p className="text-sm text-gray-500">Entregas</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">
              {entregadorProfile?.avaliacao_media?.toFixed?.(1) || '5.0'}
            </p>
            <p className="text-sm text-gray-500">Avaliacao</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">
              {formatCurrency(entregadorProfile?.saldo || 0)}
            </p>
            <p className="text-sm text-gray-500">Saldo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
