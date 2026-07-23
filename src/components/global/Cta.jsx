import { MotionWrapper } from "../utils/MotionWrapper.jsx";

export default function Cta({ data = {} }) {
  const { label, title, placeholder, button, count, avatars = [], note } = data;

  return (
    <MotionWrapper type="fade-up" className="w-full grotesque-font py-30" as="section">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10">
        <hr className="mb-6 border-t border-gray-200" />
        <div className="grid items-center gap-4">
          <div className="flex flex-col items-start md:items-end w-full">
            <h2 className="text-3xl md:text-5xl font-light grotesque-font text-right mb-4">
              {title}
            </h2>
            <form method="POST" action="/api/subscribe" className="flex w-full max-w-md mb-2">
              <input
                type="email"
                placeholder={placeholder}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l focus:outline-none"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-black text-white rounded-r font-semibold hover:bg-gray-900 transition"
              >
                {button}
              </button>
            </form>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <span>{count} {note}</span>
              <div className="flex -space-x-2">
                {avatars.map((avatar, idx) => (
                  <img
                    key={idx}
                    src={avatar}
                    alt={`User ${idx + 1}`}
                    className="w-7 h-7 rounded-full border-2 border-white"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionWrapper>
  );
}
