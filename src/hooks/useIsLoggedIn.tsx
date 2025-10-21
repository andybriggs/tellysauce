import { useSession } from "next-auth/react";

const useIsLoggedIn = (): boolean => {
  const { status } = useSession();
  return status === "authenticated";
};

export default useIsLoggedIn;
