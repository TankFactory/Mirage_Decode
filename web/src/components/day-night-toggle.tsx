/*
 * @Author: JIAZIYI007
 * @Modified by: Uyanide pywang0608@foxmail.com
 * @Date: 2025-07-14 19:00:19
 * @Reference: https://github.com/Xiumuzaidiao/Day-night-toggle-button/blob/master/%E7%99%BD%E5%A4%A9%E9%BB%91%E5%A4%9C%E5%88%87%E6%8D%A2%E6%8C%89%E9%92%AE4.0/js/script.js
 * @Discription: THE popular day-night toggle button, stateless & React version
 */

/*
ISC License

Copyright (c) [2024], [Xiumuzaidiao]

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './day-night-toggle.module.css';

type DayNightToggleProps = {
  value: 'light' | 'dark';
  size: number;
  onChange: () => void;
};

export const DayNightToggle = ({ value, size, onChange }: DayNightToggleProps) => {
  // only read inside event handlers, never rendered -- a ref avoids two renders per toggle
  const colldownRef = useRef(false);
  // indicates whether the refs are assigned
  const [ready, setReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const mainButtonRef = useRef<HTMLDivElement>(null);
  const moonRefs = useRef<HTMLDivElement[]>([]);
  const daytimeBackgroundRefs = useRef<HTMLDivElement[]>([]);
  const cloudRef = useRef<HTMLDivElement>(null);
  const cloudSonRefs = useRef<HTMLElement[]>([]);
  const cloudLightRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const starRefs = useRef<HTMLDivElement[]>([]);
  const starSonRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (rootRef.current === null) return; // should never happen though

    const selectAll = (s: string) => {
      const dom = rootRef.current!.querySelectorAll(s);
      return Array.from(dom) as HTMLDivElement[];
    };

    moonRefs.current = selectAll('.moon');
    daytimeBackgroundRefs.current = selectAll('.daytime-background');
    cloudSonRefs.current = selectAll('.cloud-son');
    starRefs.current = selectAll('.star');
    starSonRefs.current = selectAll('.star-son');

    setReady(true);

    const getRandomDirection = () => {
      const directions = ['2em', '-2em'];
      return directions[Math.floor(Math.random() * directions.length)];
    };

    const moveElementRandomly = (element: HTMLElement) => {
      const randomDirectionX = getRandomDirection();
      const randomDirectionY = getRandomDirection();
      element.style.transform = `translate(${randomDirectionX}, ${randomDirectionY})`;
    };

    const cloudSons = cloudSonRefs.current;
    setInterval(() => {
      cloudSons.forEach(moveElementRandomly);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const mainButton = mainButtonRef.current!;
    const cloud = cloudRef.current!;
    const component = componentRef.current!;
    const stars = starsRef.current!;
    const cloudLight = cloudLightRef.current!;
    const daytimeBackground = daytimeBackgroundRefs.current;
    const moon = moonRefs.current;

    // to light
    if (value === 'light') {
      mainButton.style.transform = 'translateX(0)';
      mainButton.style.backgroundColor = 'rgba(255, 195, 35,1)';

      mainButton.style.boxShadow =
        '3em 3em 5em rgba(0, 0, 0, 0.5), inset  -3em -5em 3em -3em rgba(0, 0, 0, 0.5), inset  4em 5em 2em -2em rgba(255, 230, 80,1)';

      daytimeBackground[0].style.transform = 'translateX(0)';
      daytimeBackground[1].style.transform = 'translateX(0)';
      daytimeBackground[2].style.transform = 'translateX(0)';
      cloud.style.transform = 'translateY(10em)';
      cloudLight.style.transform = 'translateY(10em)';
      component.style.backgroundColor = 'rgba(70, 133, 192,1)';

      moon[0].style.opacity = '0';
      moon[1].style.opacity = '0';
      moon[2].style.opacity = '0';

      stars.style.transform = 'translateY(-125em)';
      stars.style.opacity = '0';
    }
    // to dark
    else {
      mainButton.style.transform = 'translateX(110em)';
      mainButton.style.backgroundColor = 'rgba(195, 200,210,1)';

      mainButton.style.boxShadow =
        '3em 3em 5em rgba(0, 0, 0, 0.5), inset  -3em -5em 3em -3em rgba(0, 0, 0, 0.5), inset  4em 5em 2em -2em rgba(255, 255, 210,1)';

      daytimeBackground[0].style.transform = 'translateX(110em)';
      daytimeBackground[1].style.transform = 'translateX(80em)';
      daytimeBackground[2].style.transform = 'translateX(50em)';
      cloud.style.transform = 'translateY(80em)';
      cloudLight.style.transform = 'translateY(80em)';
      component.style.backgroundColor = 'rgba(25,30,50,1)';

      moon[0].style.opacity = '1';
      moon[1].style.opacity = '1';
      moon[2].style.opacity = '1';

      stars.style.transform = 'translateY(-62.5em)';
      stars.style.opacity = '1';
    }

    colldownRef.current = true;

    const timer = setTimeout(() => {
      colldownRef.current = false;
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [ready, value]);

  const handleMouseMove = useCallback(
    (isDark: boolean, colldown: boolean) => {
      if (!ready) return;
      if (colldown) return;

      const mainButton = mainButtonRef.current!;
      const cloudList = cloudSonRefs.current;
      const daytimeBackground = daytimeBackgroundRefs.current;
      const star = starRefs.current;

      if (isDark) {
        mainButton.style.transform = 'translateX(100em)';
        daytimeBackground[0].style.transform = 'translateX(100em)';
        daytimeBackground[1].style.transform = 'translateX(73em)';
        daytimeBackground[2].style.transform = 'translateX(46em)';

        star[0].style.top = '10em';
        star[0].style.left = '36em';
        star[1].style.top = '40em';
        star[1].style.left = '87em';
        star[2].style.top = '26em';
        star[2].style.left = '16em';
        star[3].style.top = '38em';
        star[3].style.left = '63em';
        star[4].style.top = '20.5em';
        star[4].style.left = '72em';
        star[5].style.top = '51.5em';
        star[5].style.left = '35em';
      } else {
        mainButton.style.transform = 'translateX(10em)';
        daytimeBackground[0].style.transform = 'translateX(10em)';
        daytimeBackground[1].style.transform = 'translateX(7em)';
        daytimeBackground[2].style.transform = 'translateX(4em)';

        cloudList[0].style.right = '-24em';
        cloudList[0].style.bottom = '10em';
        cloudList[1].style.right = '-12em';
        cloudList[1].style.bottom = '-27em';
        cloudList[2].style.right = '17em';
        cloudList[2].style.bottom = '-43em';
        cloudList[3].style.right = '46em';
        cloudList[3].style.bottom = '-39em';
        cloudList[4].style.right = '70em';
        cloudList[4].style.bottom = '-65em';
        cloudList[5].style.right = '109em';
        cloudList[5].style.bottom = '-54em';
        cloudList[6].style.right = '-23em';
        cloudList[6].style.bottom = '10em';
        cloudList[7].style.right = '-11em';
        cloudList[7].style.bottom = '-26em';
        cloudList[8].style.right = '18em';
        cloudList[8].style.bottom = '-42em';
        cloudList[9].style.right = '47em';
        cloudList[9].style.bottom = '-38em';
        cloudList[10].style.right = '74em';
        cloudList[10].style.bottom = '-64em';
        cloudList[11].style.right = '110em';
        cloudList[11].style.bottom = '-55em';
      }
    },
    [ready]
  );

  const handleMouseOut = useCallback(
    (isDark: boolean, colldown: boolean) => {
      if (!ready) return;
      if (colldown) return;

      const mainButton = mainButtonRef.current!;
      const cloudList = cloudSonRefs.current;
      const daytimeBackground = daytimeBackgroundRefs.current;
      const star = starRefs.current;

      if (isDark) {
        mainButton.style.transform = 'translateX(110em)';
        daytimeBackground[0].style.transform = 'translateX(110em)';
        daytimeBackground[1].style.transform = 'translateX(80em)';
        daytimeBackground[2].style.transform = 'translateX(50em)';

        star[0].style.top = '11em';
        star[0].style.left = '39em';
        star[1].style.top = '39em';
        star[1].style.left = '91em';
        star[2].style.top = '26em';
        star[2].style.left = '19em';
        star[3].style.top = '37em';
        star[3].style.left = '66em';
        star[4].style.top = '21em';
        star[4].style.left = '75em';
        star[5].style.top = '51em';
        star[5].style.left = '38em';
      } else {
        mainButton.style.transform = 'translateX(0em)';
        daytimeBackground[0].style.transform = 'translateX(0em)';
        daytimeBackground[1].style.transform = 'translateX(0em)';
        daytimeBackground[2].style.transform = 'translateX(0em)';

        cloudList[0].style.right = '-20em';
        cloudList[0].style.bottom = '10em';
        cloudList[1].style.right = '-10em';
        cloudList[1].style.bottom = '-25em';
        cloudList[2].style.right = '20em';
        cloudList[2].style.bottom = '-40em';
        cloudList[3].style.right = '50em';
        cloudList[3].style.bottom = '-35em';
        cloudList[4].style.right = '75em';
        cloudList[4].style.bottom = '-60em';
        cloudList[5].style.right = '110em';
        cloudList[5].style.bottom = '-50em';
        cloudList[6].style.right = '-20em';
        cloudList[6].style.bottom = '10em';
        cloudList[7].style.right = '-10em';
        cloudList[7].style.bottom = '-25em';
        cloudList[8].style.right = '20em';
        cloudList[8].style.bottom = '-40em';
        cloudList[9].style.right = '50em';
        cloudList[9].style.bottom = '-35em';
        cloudList[10].style.right = '75em';
        cloudList[10].style.bottom = '-60em';
        cloudList[11].style.right = '110em';
        cloudList[11].style.bottom = '-50em';
      }
    },
    [ready]
  );

  return (
    <div
      className={`${styles['container']} container`}
      style={{
        fontSize: `${(size / 3).toFixed(2)}px`,
      }}
      ref={rootRef}
    >
      <div className={`${styles['component']} component`} onClick={onChange} ref={componentRef}>
        <div
          className={`${styles['main-button']} main-button`}
          onMouseMove={() => {
            handleMouseMove(value === 'dark', colldownRef.current);
          }}
          onMouseOut={() => {
            handleMouseOut(value === 'dark', colldownRef.current);
          }}
          ref={mainButtonRef}
        >
          <div className={`${styles['moon']} moon`}></div>
          <div className={`${styles['moon']} moon`}></div>
          <div className={`${styles['moon']} moon`}></div>
        </div>
        <div className={`${styles['daytime-background']} daytime-background`}></div>
        <div className={`${styles['daytime-background']} daytime-background`}></div>
        <div className={`${styles['daytime-background']} daytime-background`}></div>
        <div className={`${styles['cloud']} cloud`} ref={cloudRef}>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
        </div>
        <div className={`${styles['cloud-light']} cloud-light`} ref={cloudLightRef}>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
          <div className={`${styles['cloud-son']} cloud-son`}></div>
        </div>
        <div className={`${styles['stars']} stars`} ref={starsRef}>
          <div className={`${styles['star']} ${styles['big']} star big`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
          <div className={`${styles['star']} ${styles['big']} star big`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
          <div className={`${styles['star']} ${styles['medium']} star medium`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
          <div className={`${styles['star']} ${styles['medium']} star medium`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
          <div className={`${styles['star']} ${styles['small']} star small`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
          <div className={`${styles['star']} ${styles['small']} star small`}>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
            <div className={`${styles['star-son']} star-son`}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
