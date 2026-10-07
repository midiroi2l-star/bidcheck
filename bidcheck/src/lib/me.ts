import { createContext, useContext } from "react";
import type { User } from "../../shared/types";

/** 로그인한 사용자 정보 */
export const MeContext = createContext<User | null>(null);
export const useMe = () => useContext(MeContext);
