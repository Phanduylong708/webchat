import bcrypt from "bcryptjs";

const hashPassword = async (password) => {
  const hashed = await bcrypt.hash(password, 10);
  return hashed;
};

const comparePassword = async (password, hashedPassword) => {
  const isMatch = await bcrypt.compare(password, hashedPassword);
  return isMatch;
};
export { hashPassword, comparePassword };
