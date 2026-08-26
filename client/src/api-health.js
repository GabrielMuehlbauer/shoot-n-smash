export function describeApiHealth(httpStatus, payload) {
  if (
    httpStatus === 503 &&
    payload?.status === 'degraded' &&
    payload?.database?.status === 'unavailable'
  ) {
    return {
      state: 'warning',
      message: 'API online, mas o MySQL está indisponível. Verifique a configuração do banco.',
    };
  }

  if (httpStatus >= 200 && httpStatus < 300 && payload?.status === 'ok') {
    const databaseMessage =
      payload.database?.status === 'connected'
        ? 'MySQL conectado.'
        : 'MySQL ainda não configurado, como esperado nesta etapa.';

    return {
      state: 'success',
      message: `API online. ${databaseMessage}`,
    };
  }

  return null;
}
