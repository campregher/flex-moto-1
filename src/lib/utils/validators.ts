// CPF Validation
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '')
  
  if (cleanCPF.length !== 11) return false
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCPF)) return false
  
  // Validate first digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF[9])) return false
  
  // Validate second digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCPF[10])) return false
  
  return true
}

// CNPJ Validation
export function validateCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '')
  
  if (cleanCNPJ.length !== 14) return false
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false
  
  // Validate first digit
  let size = cleanCNPJ.length - 2
  let numbers = cleanCNPJ.substring(0, size)
  const digits = cleanCNPJ.substring(size)
  let sum = 0
  let pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  
  // Validate second digit
  size = size + 1
  numbers = cleanCNPJ.substring(0, size)
  sum = 0
  pos = size - 7
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) return false
  
  return true
}

// WhatsApp validation (Brazilian format)
export function validateWhatsApp(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '')
  // Brazilian phone: 11 digits (with area code) or 10 digits (landline)
  return cleanPhone.length === 11 || cleanPhone.length === 10
}

// License plate validation (Brazilian format - old and Mercosul)
export function validatePlaca(placa: string): boolean {
  const cleanPlaca = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  // Old format: ABC1234
  // Mercosul format: ABC1D23
  const oldFormat = /^[A-Z]{3}[0-9]{4}$/
  const mercosulFormat = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
  
  return oldFormat.test(cleanPlaca) || mercosulFormat.test(cleanPlaca)
}

// Format CPF for display
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '')
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// Format CNPJ for display
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/\D/g, '')
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

// Format phone for display
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

// Generate random code for delivery confirmation
export function generateCode(length: number = 6): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
