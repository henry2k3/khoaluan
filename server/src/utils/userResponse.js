// Chọn rõ trường được trả ra ngoài, không gửi passwordHash về frontend.
export function userResponse(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  };
}
