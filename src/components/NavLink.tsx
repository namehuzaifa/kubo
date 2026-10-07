import { Link } from "@tanstack/react-router";

/**
 * A menu entry whose destination comes from the database.
 *
 * Router links are typed against the known routes, but these hrefs are typed in
 * by staff and may point anywhere, so the internal case is cast and anything
 * else falls back to a plain anchor — which also means an external link still
 * works if someone adds one.
 */
export function NavLink({
  href,
  className,
  activeClassName,
  exact,
  children,
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const isInternal = href.startsWith("/");

  if (!isInternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link
      to={href as "/"}
      search={{} as never}
      activeOptions={{ exact: exact ?? href === "/" }}
      {...(activeClassName ? { activeProps: { className: activeClassName } } : {})}
      className={className}
    >
      {children}
    </Link>
  );
}
