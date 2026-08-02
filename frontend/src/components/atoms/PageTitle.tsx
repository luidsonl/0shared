interface PageTitleProps {
  children: string;
}

export default function PageTitle({ children }: PageTitleProps) {
  return <h2 className="page-title">{children}</h2>;
}
