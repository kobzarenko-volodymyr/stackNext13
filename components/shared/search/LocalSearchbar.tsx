"use client";

import { Input } from "@/components/ui/input";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formUrlQuery, removeKeysFromQuery } from "@/lib/utils";

interface CustomInputProps {
  route: string;
  iconPosition: string;
  imgSrc: string;
  placeholder: string;
  otherClasses?: string;
}

const LocalSearchbar = ({
  route,
  iconPosition,
  imgSrc,
  placeholder,
  otherClasses,
}: CustomInputProps) => {
  // Роут Некста!
  const router = useRouter();
  // что бы знать на каком URL в Браузере мы в данный момент
  const pathname = usePathname();
  // берём значения после "?" в URL
  const searchParams = useSearchParams();

  // можем брать из URL, то что нужно ?q=value&next=update&page=1 ...
  const query = searchParams.get("q");

  const [search, setSearch] = useState(query || "");

  useEffect(() => {
    // Чтобы не делать запрос к базе каждую секунду делаем отложенный вызов
    const delayDebounceFn = setTimeout(() => {
      if (search) {
        const newUrl = formUrlQuery({
          // дублируем уже существующие параметры, чтобы случайно не затереть их
          params: searchParams.toString(),
          // добавляем в URL нужные нам параметры
          key: "q",
          value: search,
        });

        // Вставляем новый URL
        // scroll: false указывает маршрутизатору не прокручивать страницу к верху после перехода на новый URL
        router.push(newUrl, { scroll: false });
        //
      } else {
        console.log(route, pathname);
        // ВАЖНО!
        // Проверка если текущий URL браузера === Текущему роуту Некста!!!!
        if (pathname === route) {
          // функция для очистки праметров URL, чтобы чистить (q=value)
          const newUrl = removeKeysFromQuery({
            params: searchParams.toString(),
            keysToRemove: ["q"],
          });

          // Вставляем новый URL
          router.push(newUrl, { scroll: false });
        }
      }
    }, 300);

    // clean-up функция в UseEffect которая вызывается при Unmount-е компонента!
    // в данном случае сбрасываем счетчик
    return () => clearTimeout(delayDebounceFn);
  }, [search, route, pathname, router, searchParams, query]);

  return (
    <div
      className={`background-light800_darkgradient flex min-h-[56px] grow items-center gap-4 rounded-[10px] px-4 ${otherClasses}`}
    >
      {iconPosition === "left" && (
        <Image
          src={imgSrc}
          alt="search icon"
          width={24}
          height={24}
          className="cursor-pointer"
        />
      )}

      <Input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="paragraph-regular no-focus placeholder background-light800_darkgradient border-none shadow-none outline-none"
      />

      {iconPosition === "right" && (
        <Image
          src={imgSrc}
          alt="search icon"
          width={24}
          height={24}
          className="cursor-pointer"
        />
      )}
    </div>
  );
};

export default LocalSearchbar;
