'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, Rating } from '@/components/ui'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { formatCPF, formatPhone } from '@/lib/utils'
import { validateWhatsApp } from '@/lib/utils/validators'
import toast from 'react-hot-toast'
import {
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineIdentification,
  HiOutlineLocationMarker,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineTrash,
} from 'react-icons/hi'

type ColetaForm = {
  label: string
  endereco: string
  latitude: number | null
  longitude: number | null
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

type ColetaItem = ColetaForm & {
  id: string
  is_default: boolean | null
}

export default function LojistaPerfilPage() {
  const { user, profile, setProfile, setUser } = useAuthStore()
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState((profile as any)?.foto_url || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    endereco_base: (profile as any).endereco_base || '',
    endereco_latitude: (profile as any).endereco_latitude ?? null,
    endereco_longitude: (profile as any).endereco_longitude ?? null,
    endereco_logradouro: (profile as any).endereco_logradouro || '',
    endereco_numero: (profile as any).endereco_numero || '',
    endereco_bairro: (profile as any).endereco_bairro || '',
    endereco_cidade: (profile as any).endereco_cidade || '',
    endereco_uf: (profile as any).endereco_uf || '',
    endereco_cep: (profile as any).endereco_cep || '',
  })
  const [coletas, setColetas] = useState<ColetaItem[]>([])
  const [coletasLoading, setColetasLoading] = useState(true)
  const [coletaSaving, setColetaSaving] = useState(false)
  const [newColeta, setNewColeta] = useState<ColetaForm>({
    label: '',
    endereco: '',
    latitude: null,
    longitude: null,
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
  })
  const [newColetaDefault, setNewColetaDefault] = useState(false)
  const [editColetaId, setEditColetaId] = useState<string | null>(null)
  const [editColeta, setEditColeta] = useState<ColetaForm | null>(null)
  const supabase = createClient()

  const lojistaProfile = profile as any

  useEffect(() => {
    async function loadColetas() {
      if (!lojistaProfile.id) return
      setColetasLoading(true)
      const { data } = await supabase
        .from('lojista_coletas')
        .select('*')
        .eq('lojista_id', lojistaProfile.id)
        .order('created_at', { ascending: true })

      setColetas((data || []) as ColetaItem[])
      setColetasLoading(false)
    }

    loadColetas()
  }, [lojistaProfile.id, supabase])

  useEffect(() => {
    setWhatsapp(user?.whatsapp || '')
  }, [user?.whatsapp])

  const normalizeFotoUrl = (url: string | null | undefined) => {
    if (!url) return ''
    if (url.includes('/storage/v1/object/public/')) return url
    if (url.includes('/storage/v1/object/fotos/')) {
      return url.replace('/storage/v1/object/fotos/', '/storage/v1/object/public/fotos/')
    }
    return url
  }

  const extractFotoPath = (url: string | null | undefined) => {
    if (!url) return ''
    if (url.startsWith('lojistas/')) return url
    const publicMarker = '/storage/v1/object/public/fotos/'
    const privateMarker = '/storage/v1/object/fotos/'
    if (url.includes(publicMarker)) {
      return url.split(publicMarker)[1] || ''
    }
    if (url.includes(privateMarker)) {
      return url.split(privateMarker)[1] || ''
    }
    return ''
  }

  useEffect(() => {
    setFotoPreview(normalizeFotoUrl(lojistaProfile?.foto_url))
  }, [lojistaProfile?.foto_url])

  useEffect(() => {
    const fotoUrl = lojistaProfile?.foto_url
    const fotoPath = extractFotoPath(fotoUrl)
    if (!fotoPath) return

    supabase.storage
      .from('fotos')
        .createSignedUrl(fotoPath, 3600)
        .then(({ data, error }: { data: { signedUrl?: string } | null; error: unknown }) => {
        if (!error && data?.signedUrl) {
          setFotoPreview(data.signedUrl)
        }
      })
  }, [lojistaProfile?.foto_url, supabase])

  useEffect(() => {
    const fotoUrl = lojistaProfile?.foto_url
    if (!fotoUrl || !lojistaProfile?.id) return
    if (!fotoUrl.includes('/storage/v1/object/fotos/')) return

    const normalized = normalizeFotoUrl(fotoUrl)
    if (normalized === fotoUrl) return

    supabase
      .from('lojistas')
      .update({ foto_url: normalized })
      .eq('id', lojistaProfile.id)
      .then(({ error }: { error: unknown }) => {
        if (!error) {
          setProfile({ ...lojistaProfile, foto_url: normalized })
        }
      })
  }, [lojistaProfile?.foto_url, lojistaProfile?.id, setProfile, supabase])

  const handleFotoChange = (file: File | null) => {
    setFotoFile(file)
    if (!file) {
      setFotoPreview(lojistaProfile?.foto_url || '')
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

  async function handleSaveProfile() {
    if (!user || !lojistaProfile) return

    const cleanPhone = whatsapp.replace(/\D/g, '')
    if (!validateWhatsApp(cleanPhone)) {
      toast.error('Informe um WhatsApp valido')
      return
    }

    setProfileSaving(true)
    try {
      let fotoUrl = lojistaProfile.foto_url
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop() || 'jpg'
        const filePath = `lojistas/${user.id}/perfil.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('fotos')
          .upload(filePath, fotoFile, { upsert: true, contentType: fotoFile.type || 'image/jpeg' })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(filePath)
        fotoUrl = urlData.publicUrl || filePath

        const { error: fotoError } = await supabase
          .from('lojistas')
          .update({ foto_url: fotoUrl })
          .eq('id', lojistaProfile.id)

        if (fotoError) throw fotoError
      }

      const { error: whatsappError } = await supabase
        .from('users')
        .update({ whatsapp: cleanPhone })
        .eq('id', user.id)

      if (whatsappError) throw whatsappError

      setProfile({ ...lojistaProfile, foto_url: fotoUrl })
      setUser({ ...user, whatsapp: cleanPhone })
      toast.success('Perfil atualizado!')
      setProfileEditing(false)
      setFotoFile(null)
    } catch (err) {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('lojistas')
        .update({
          endereco_base: formData.endereco_base,
          endereco_latitude: formData.endereco_latitude,
          endereco_longitude: formData.endereco_longitude,
          endereco_logradouro: formData.endereco_logradouro || null,
          endereco_numero: formData.endereco_numero || null,
          endereco_bairro: formData.endereco_bairro || null,
          endereco_cidade: formData.endereco_cidade || null,
          endereco_uf: formData.endereco_uf || null,
          endereco_cep: formData.endereco_cep || null,
        })
        .eq('id', lojistaProfile.id)

      if (error) throw error

      setProfile({ ...lojistaProfile, ...formData })
      toast.success('Perfil atualizado!')
      setEditing(false)
    } catch (err) {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  async function setDefaultColeta(coletaId: string) {
    if (!lojistaProfile.id) return
    setColetaSaving(true)
    try {
      await supabase
        .from('lojista_coletas')
        .update({ is_default: false })
        .eq('lojista_id', lojistaProfile.id)

      const { error } = await supabase
        .from('lojista_coletas')
        .update({ is_default: true })
        .eq('id', coletaId)

      if (error) throw error

      setColetas((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === coletaId,
        }))
      )
      toast.success('EndereÃƒÂ§o padrÃƒÂ£o atualizado')
    } catch (err) {
      toast.error('Erro ao definir endereÃƒÂ§o padrÃƒÂ£o')
    } finally {
      setColetaSaving(false)
    }
  }

  async function handleAddColeta() {
    if (!lojistaProfile.id) return
    if (!newColeta.endereco.trim()) {
      toast.error('Informe o endereÃƒÂ§o de coleta')
      return
    }
    if (coletas.length >= 4) {
      toast.error('MÃƒÂ¡ximo de 4 endereÃƒÂ§os de coleta')
      return
    }

    setColetaSaving(true)
    try {
      if (newColetaDefault) {
        await supabase
          .from('lojista_coletas')
          .update({ is_default: false })
          .eq('lojista_id', lojistaProfile.id)
      }

      const { data, error } = await supabase
        .from('lojista_coletas')
        .insert({
          lojista_id: lojistaProfile.id,
          label: newColeta.label || null,
          endereco: newColeta.endereco,
          latitude: newColeta.latitude,
          longitude: newColeta.longitude,
          logradouro: newColeta.logradouro || null,
          numero: newColeta.numero || null,
          bairro: newColeta.bairro || null,
          cidade: newColeta.cidade || null,
          uf: newColeta.uf || null,
          cep: newColeta.cep || null,
          is_default: newColetaDefault || coletas.length === 0,
        })
        .select()
        .single()

      if (error) throw error

      setColetas((prev) => [...prev, data as ColetaItem])
      setNewColeta({
        label: '',
        endereco: '',
        latitude: null,
        longitude: null,
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        uf: '',
        cep: '',
      })
      setNewColetaDefault(false)
      toast.success('EndereÃƒÂ§o de coleta adicionado')
    } catch (err) {
      toast.error('Erro ao adicionar endereÃƒÂ§o')
    } finally {
      setColetaSaving(false)
    }
  }

  async function handleDeleteColeta(coletaId: string) {
    setColetaSaving(true)
    try {
      const { error } = await supabase
        .from('lojista_coletas')
        .delete()
        .eq('id', coletaId)

      if (error) throw error

      setColetas((prev) => prev.filter((item) => item.id !== coletaId))
      toast.success('EndereÃƒÂ§o removido')
    } catch (err) {
      toast.error('Erro ao remover endereÃƒÂ§o')
    } finally {
      setColetaSaving(false)
    }
  }

  async function handleSaveEditColeta() {
    if (!editColetaId || !editColeta) return
    if (!editColeta.endereco.trim()) {
      toast.error('Informe o endereÃƒÂ§o de coleta')
      return
    }
    setColetaSaving(true)
    try {
      const { error } = await supabase
        .from('lojista_coletas')
        .update({
          label: editColeta.label || null,
          endereco: editColeta.endereco,
          latitude: editColeta.latitude,
          longitude: editColeta.longitude,
          logradouro: editColeta.logradouro || null,
          numero: editColeta.numero || null,
          bairro: editColeta.bairro || null,
          cidade: editColeta.cidade || null,
          uf: editColeta.uf || null,
          cep: editColeta.cep || null,
        })
        .eq('id', editColetaId)

      if (error) throw error

      setColetas((prev) =>
        prev.map((item) =>
          item.id === editColetaId
            ? { ...item, ...editColeta }
            : item
        )
      )
      setEditColetaId(null)
      setEditColeta(null)
      toast.success('Endereço atualizado')
    } catch (err) {
      toast.error('Erro ao atualizar endere?o')
    } finally {
      setColetaSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Perfil</h1>

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Avatar src={fotoPreview || lojistaProfile?.foto_url} name={user?.nome || ''} size="xl" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.nome}</h2>
              <p className="text-gray-500">Lojista</p>
              <div className="flex items-center gap-2 mt-1">
                <Rating value={lojistaProfile?.avaliacao_media || 5} size="sm" />
                <span className="text-sm text-gray-500">
                  ({lojistaProfile.total_avaliacoes || 0} avalia?es)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setProfileEditing((prev) => !prev)}
            className="btn-ghost text-primary-600"
          >
            <HiOutlinePencil className="w-5 h-5" />
          </button>
        </div>

        {profileEditing && (
          <div className="space-y-4 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Foto de perfil</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFotoChange(e.target.files?.[0] || null)}
                className="input"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="input"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setProfileEditing(false)
                  setWhatsapp(user?.whatsapp || '')
                  setFotoFile(null)
                  setFotoPreview(lojistaProfile?.foto_url || '')
                }}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="btn-primary flex-1"
              >
                {profileSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
<div className="grid gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineMail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlinePhone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">WhatsApp</p>
              <p className="font-medium text-gray-900">{formatPhone(user?.whatsapp || '')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineIdentification className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">CPF</p>
              <p className="font-medium text-gray-900">{formatCPF(user?.cpf || '')}</p>
            </div>
          </div>

          {lojistaProfile.cnpj && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <HiOutlineIdentification className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">CNPJ</p>
                <p className="font-medium text-gray-900">{lojistaProfile.cnpj}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">EndereÃƒÂ§o de Coleta</h3>
          <button
            onClick={() => setEditing(!editing)}
            className="btn-ghost text-primary-600"
          >
            <HiOutlinePencil className="w-5 h-5" />
          </button>
        </div>

        {editing ? (
          <div className="space-y-4">
            <AddressAutocomplete
              value={formData.endereco_base}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, endereco_base: value }))
              }
              onSelect={(details) =>
                setFormData((prev) => ({
                  ...prev,
                  endereco_base: details.formattedAddress || prev.endereco_base,
                  endereco_latitude: details.lat ?? prev.endereco_latitude,
                  endereco_longitude: details.lng ?? prev.endereco_longitude,
                  endereco_logradouro: details.street || prev.endereco_logradouro,
                  endereco_numero: details.number || prev.endereco_numero,
                  endereco_bairro: details.neighborhood || prev.endereco_bairro,
                  endereco_cidade: details.city || prev.endereco_cidade,
                  endereco_uf: details.state || prev.endereco_uf,
                  endereco_cep: details.postalCode || prev.endereco_cep,
                }))
              }
              placeholder="EndereÃƒÂ§o completo para coletas"
              className="input"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="btn-outline flex-1">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <HiOutlineLocationMarker className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-700">
              {lojistaProfile?.endereco_base || 'Nenhum endereÃƒÂ§o cadastrado'}
            </p>
          </div>
        )}
      </div>

      {/* Multiple Pickup Addresses */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">EndereÃƒÂ§os de Coleta (atÃƒÂ© 4)</h3>
            <p className="text-sm text-gray-500">
              Use estes endereÃƒÂ§os para criar corridas e importar pedidos do Mercado Livre.
            </p>
          </div>
          <span className="text-sm text-gray-600">{coletas.length}/4</span>
        </div>

        {coletasLoading ? (
          <p className="text-sm text-gray-500">Carregando endereÃƒÂ§os...</p>
        ) : coletas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum endereÃƒÂ§o cadastrado.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {coletas.map((coleta) => (
              <div key={coleta.id} className="border border-gray-200 rounded-lg p-3">
                {editColetaId === coleta.id && editColeta ? (
                  <div className="space-y-3">
                    <input
                      value={editColeta.label}
                      onChange={(e) => setEditColeta({ ...editColeta, label: e.target.value })}
                      className="input"
                      placeholder="Apelido (ex: Loja Centro)"
                    />
                    <AddressAutocomplete
                      value={editColeta.endereco}
                      onChange={(value) =>
                        setEditColeta({ ...editColeta, endereco: value })
                      }
                      onSelect={(details) =>
                        setEditColeta({
                          ...editColeta,
                          endereco: details.formattedAddress || editColeta.endereco,
                          latitude: details.lat ?? editColeta.latitude,
                          longitude: details.lng ?? editColeta.longitude,
                          logradouro: details.street || editColeta.logradouro,
                          numero: details.number || editColeta.numero,
                          bairro: details.neighborhood || editColeta.bairro,
                          cidade: details.city || editColeta.cidade,
                          uf: details.state || editColeta.uf,
                          cep: details.postalCode || editColeta.cep,
                        })
                      }
                      placeholder="EndereÃƒÂ§o completo"
                      className="input"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="btn-outline flex-1"
                        onClick={() => {
                          setEditColetaId(null)
                          setEditColeta(null)
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        disabled={coletaSaving}
                        onClick={handleSaveEditColeta}
                      >
                        {coletaSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {coleta.label || 'EndereÃƒÂ§o de coleta'}
                        {coleta.is_default && (
                          <span className="ml-2 text-xs text-green-600">PadrÃƒÂ£o</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600">{coleta.endereco}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!coleta.is_default && (
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => setDefaultColeta(coleta.id)}
                          disabled={coletaSaving}
                        >
                          Definir padrÃƒÂ£o
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost text-primary-600"
                        onClick={() => {
                          setEditColetaId(coleta.id)
                          setEditColeta({
                            label: coleta.label || '',
                            endereco: coleta.endereco,
                            latitude: coleta.latitude,
                            longitude: coleta.longitude,
                            logradouro: coleta.logradouro || '',
                            numero: coleta.numero || '',
                            bairro: coleta.bairro || '',
                            cidade: coleta.cidade || '',
                            uf: coleta.uf || '',
                            cep: coleta.cep || '',
                          })
                        }}
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-red-600"
                        onClick={() => handleDeleteColeta(coleta.id)}
                        disabled={coletaSaving}
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Adicionar novo endereÃƒÂ§o</h4>
          <div className="space-y-3">
            <input
              value={newColeta.label}
              onChange={(e) => setNewColeta((prev) => ({ ...prev, label: e.target.value }))}
              className="input"
              placeholder="Apelido (ex: Loja Centro)"
            />
            <AddressAutocomplete
              value={newColeta.endereco}
              onChange={(value) => setNewColeta((prev) => ({ ...prev, endereco: value }))}
              onSelect={(details) =>
                setNewColeta((prev) => ({
                  ...prev,
                  endereco: details.formattedAddress || prev.endereco,
                  latitude: details.lat ?? prev.latitude,
                  longitude: details.lng ?? prev.longitude,
                  logradouro: details.street || prev.logradouro,
                  numero: details.number || prev.numero,
                  bairro: details.neighborhood || prev.bairro,
                  cidade: details.city || prev.cidade,
                  uf: details.state || prev.uf,
                  cep: details.postalCode || prev.cep,
                }))
              }
              placeholder="EndereÃƒÂ§o completo"
              className="input"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newColetaDefault}
                onChange={(e) => setNewColetaDefault(e.target.checked)}
              />
              Definir como endereÃƒÂ§o padrÃƒÂ£o
            </label>
            <button
              type="button"
              onClick={handleAddColeta}
              disabled={coletaSaving || coletas.length >= 4}
              className="btn-secondary w-full"
            >
              <HiOutlinePlus className="w-5 h-5 mr-2" />
              Adicionar endereÃƒÂ§o de coleta
            </button>
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">EstatÃƒÂ­sticas</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary-600">{lojistaProfile?.total_corridas || 0}</p>
            <p className="text-sm text-gray-500">Corridas</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary-600">
              {lojistaProfile?.avaliacao_media?.toFixed(1) || '5.0'}
            </p>
            <p className="text-sm text-gray-500">AvaliaÃƒÂ§ÃƒÂ£o</p>
          </div>
        </div>
      </div>
    </div>
  )
}


