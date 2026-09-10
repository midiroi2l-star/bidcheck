export function PageSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <div className="skeleton h-6 w-56 rounded-lg" />
        <div className="skeleton mt-2 h-4 w-96 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl xl:col-span-2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  )
}
