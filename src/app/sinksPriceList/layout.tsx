import SinksProgramLayout from "./SinksProgramLayout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SinksProgramLayout>{children}</SinksProgramLayout>;
}
