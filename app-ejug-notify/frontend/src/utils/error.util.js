export function getErrorMessage (error, fallback = 'Não foi possível concluir a operação.') {
  return error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
}
