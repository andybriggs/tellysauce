const Hero = () => (
  <>
    <div className="flex justify-center items-center">
      <div className="flex items-center">
        <img
          src="/logo.png"
          alt="Telly Sauce logo"
          className="h-20 w-auto mr-4"
        />
        <div className="text-left leading-tight">
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-200">
            Telly
          </p>
          <p className="text-3xl sm:text-4xl font-bold text-[#EA3B24]">Sauce</p>
        </div>
      </div>
    </div>
    <p className="max-w-xl mx-auto mt-12 text-xl sm:text-2xl font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
      Get started by searching for your favorite titles
    </p>
  </>
);

export default Hero;
