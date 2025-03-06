// Обработчик для модификации часового пояса
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setTimezoneProtection') {
    if (request.enabled) {
      // Если защита часового пояса включена, перезаписываем методы Date
      overrideTimezone();
      sendResponse({ success: true });
    } else {
      // Если защита выключена, восстанавливаем оригинальные методы
      restoreTimezone();
      sendResponse({ success: true });
    }
  }
  return true;
});

// Проверяем текущее состояние защиты при загрузке страницы
chrome.runtime.sendMessage({ action: 'getProxyState' }, (response) => {
  if (response && response.proxyState && 
      response.proxyState.timezoneProtection && 
      response.proxyState.useAlternativeTimezoneProtection) {
    // Применяем защиту, если она включена и используется альтернативный метод
    overrideTimezone();
  }
});

// Флаг, чтобы следить за состоянием переопределения
let timezoneOverridden = false;

// Функция для переопределения методов Date, чтобы скрыть часовой пояс
function overrideTimezone() {
  if (timezoneOverridden) return; // Избегаем повторного переопределения
  
  const script = document.createElement('script');
  script.id = 'timezone-protection-script';
  script.textContent = `
    (function() {
      // Сохраняем оригинальные методы в глобальной переменной
      window._originalDateMethods = {
        getTimezoneOffset: Date.prototype.getTimezoneOffset,
        toLocaleString: Date.prototype.toLocaleString,
        toLocaleDateString: Date.prototype.toLocaleDateString,
        toLocaleTimeString: Date.prototype.toLocaleTimeString
      };
      
      // Перезаписываем метод getTimezoneOffset, чтобы всегда возвращать 0 (UTC/GMT+0)
      Date.prototype.getTimezoneOffset = function() {
        return 0;
      };
      
      // Перезаписываем методы локализации, чтобы использовать UTC
      Date.prototype.toLocaleString = function() {
        return this.toUTCString();
      };
      
      Date.prototype.toLocaleDateString = function() {
        return this.toUTCString().split(' ').slice(0, 4).join(' ');
      };
      
      Date.prototype.toLocaleTimeString = function() {
        return this.toUTCString().split(' ').slice(4).join(' ');
      };
      
      // Информируем об успешной модификации
      console.log('Альтернативная защита часового пояса активирована');
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
  timezoneOverridden = true;
}

// Функция для восстановления оригинальных методов Date
function restoreTimezone() {
  if (!timezoneOverridden) return; // Нечего восстанавливать
  
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Если оригинальные методы были сохранены, восстанавливаем их
      if (window._originalDateMethods) {
        Date.prototype.getTimezoneOffset = window._originalDateMethods.getTimezoneOffset;
        Date.prototype.toLocaleString = window._originalDateMethods.toLocaleString;
        Date.prototype.toLocaleDateString = window._originalDateMethods.toLocaleDateString;
        Date.prototype.toLocaleTimeString = window._originalDateMethods.toLocaleTimeString;
        
        // Удаляем сохраненные методы
        delete window._originalDateMethods;
        
        console.log('Альтернативная защита часового пояса деактивирована');
      }
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
  timezoneOverridden = false;
} 