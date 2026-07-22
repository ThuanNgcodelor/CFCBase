export function unwrapApiData(response) {
  return response?.data?.data ?? response?.data;
}

export function normalizePage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      number: 0,
      size: data.length,
      totalElements: data.length,
      totalPages: data.length > 0 ? 1 : 0,
    };
  }

  return {
    content: Array.isArray(data?.content) ? data.content : [],
    number: Number(data?.number ?? data?.page ?? 0),
    size: Number(data?.size ?? 0),
    totalElements: Number(data?.totalElements ?? 0),
    totalPages: Number(data?.totalPages ?? 0),
  };
}
