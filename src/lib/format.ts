export const soDigitos = (v: string) => v.replace(/\D/g, '')

export function cpfValido(v: string) {
  const c = soDigitos(v)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10])
}

export const formatarCpf = (v: string) =>
  soDigitos(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4')

export const formatarData = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')

export const nomeArquivoSeguro = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
