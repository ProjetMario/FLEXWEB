export default function Breadcrumb({ data = [], title, pageTitle }) {
  return (
    <section className="w-full">
      <div className="max-w-8xl mx-auto px-5 py-4 md:px-7">
        {title && <h1 className="text-2xl font-medium text-gray-900 mb-4">{title}</h1>}
        <ol className="flex flex-wrap text-sm text-gray-500">
          {data.map((crumb, idx) => (
            <li key={idx} className="flex items-center">
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-gray-700 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="font-medium text-gray-700">{crumb.label}</span>
              )}
              {idx < data.length - 1 && <span className="mx-2">/</span>}
            </li>
          ))}
          {pageTitle && (
            <li className="flex items-center">
              <span className="mx-2">/</span>
              <span className="font-medium text-gray-900">{pageTitle}</span>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
