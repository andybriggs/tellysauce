const Hero = () => (
  <>
    <div className="flex justify-center">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow flex items-end justify-center">
          <img
            src="/logo-t.png"
            alt="Telly Sauce logo"
            className="h-16 sm:h-18 md:h-20 w-auto mr-2 sm:mr-4"
          />
          Telly Sauce
        </h1>
        <p className="mt-4 text-base sm:text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
          Get started by searching for your favorite titles
        </p>
      </div>
    </div>
  </>
);

export default Hero;
