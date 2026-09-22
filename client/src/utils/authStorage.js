const tokenKey = 'restaurant_qr_access_token';

// sessionStorage giữ token khi tải lại trang trong cùng tab; không lưu mật khẩu.
export function getAccessToken() {
  return sessionStorage.getItem(tokenKey);
}

export function saveAccessToken(token) {
  sessionStorage.setItem(tokenKey, token);
}

export function removeAccessToken() {
  sessionStorage.removeItem(tokenKey);
}
