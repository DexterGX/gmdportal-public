"use client";
import Navbar from "./Navbar";

export default function NavbarClient({ user }: { user: any }) {
  return <Navbar user={user} />;
}
