import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { findUserByIdentifier } from "../../api/services/auth.service.js";
import { comparePassword } from "../utils/hash.util.js";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { prisma } from "../prisma.js";

passport.use(
  "login",
  new LocalStrategy(
    {
      usernameField: "identifier", // can be either email or username
      passwordField: "password",
    },
    async (identifier, password, done) => {
      try {
        const user = await findUserByIdentifier(identifier);
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          return done(null, false, { message: "Invalid credentials" });
        }
        delete user.password; // Remove password before returning user
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};
passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: jwt_payload.sub },
        select: { id: true, email: true, username: true },
      });
      if (!user) {
        return done(null, false, { message: "User not found" });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);
export { passport };
