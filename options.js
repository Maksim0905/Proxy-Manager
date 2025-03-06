document.addEventListener('DOMContentLoaded', function() {
  // Элементы управления прокси
  const proxyInput = document.getElementById('proxy-input');
  const proxyListInput = document.getElementById('proxy-list-input');
  const addProxyBtn = document.getElementById('add-proxy');
  const addProxyListBtn = document.getElementById('add-proxy-list');
  const uploadProxyFileBtn = document.getElementById('upload-proxy-file');
  const checkAllProxiesBtn = document.getElementById('check-all-proxies');
  const removeInvalidProxiesBtn = document.getElementById('remove-invalid-proxies');
  const removeAllProxiesBtn = document.getElementById('remove-all-proxies');
  const proxyListElement = document.getElementById('proxy-list');
  
  // Элементы управления локальными адресами
  const bypassInput = document.getElementById('bypass-input');
  const addBypassBtn = document.getElementById('add-bypass');
  const resetBypassBtn = document.getElementById('reset-bypass');
  const bypassListContainer = document.getElementById('bypass-list-container');
  
  // Общие элементы
  const statusDiv = document.getElementById('status');
  
  // Кнопки покупки прокси
  const buyProxyBtn = document.getElementById('buy-proxy');
  const buyProxyBypassBtn = document.getElementById('buy-proxy-bypass');
  
  // Вкладки
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Загружаем данные
  loadProxyList();
  loadBypassList();
  
  // Добавляем автообновление списка прокси каждые 3 секунды
  // для отображения изменений в статусе
  let proxyListRefreshInterval = setInterval(function() {
    // Обновляем только если открыта вкладка с прокси
    if (document.getElementById('proxies-tab').classList.contains('active')) {
      loadProxyList();
    }
  }, 3000);
  
  // Очищаем интервал при выходе со страницы
  window.addEventListener('beforeunload', function() {
    clearInterval(proxyListRefreshInterval);
  });
  
  // Обработчик для загрузки прокси из файла
  uploadProxyFileBtn.addEventListener('click', function() {
    const fileInput = document.getElementById('proxy-file');
    
    if (!fileInput.files || fileInput.files.length === 0) {
      showStatus('Выберите файл с прокси', false);
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const fileContent = e.target.result;
      if (!fileContent) {
        showStatus('Файл пуст', false);
        return;
      }
      
      // Обрабатываем содержимое файла как список прокси
      const result = processProxyList(fileContent);
      
      if (result.valid.length === 0) {
        showStatus('В файле не найдено валидных прокси', false);
        return;
      }
      
      showStatus(`Найдено ${result.valid.length} прокси в файле. Загрузка...`, false);
      
      // Отправляем прокси в background.js
      chrome.runtime.sendMessage({ 
        action: 'addProxyList', 
        proxies: result.valid 
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
          return;
        }
        
        if (response && response.success) {
          fileInput.value = ''; // Сбрасываем поле выбора файла
          
          const totalCount = response.added;
          const failedCount = response.failed || 0;
          
          let message = `Добавлено ${totalCount} прокси из файла.`;
          if (failedCount > 0) {
            message += ` Не удалось добавить ${failedCount} прокси.`;
          }
          
          if (result.invalid.length > 0) {
            message += ` Некорректный формат: ${result.invalid.length} строк.`;
          }
          
          showStatus(message, true);
          
          // Перезагружаем список прокси
          loadProxyList();
        } else {
          showStatus('Ошибка при добавлении прокси из файла: ' + (response?.error || 'Неизвестная ошибка'), false);
        }
      });
    };
    
    reader.onerror = function() {
      showStatus('Ошибка при чтении файла', false);
    };
    
    reader.readAsText(file);
  });
  
  // Обработчики вкладок
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Убираем активный класс со всех вкладок и содержимого
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Активируем выбранную вкладку и её содержимое
      tab.classList.add('active');
      document.getElementById(tabId + '-tab').classList.add('active');
    });
  });

  // Добавление одного прокси
  addProxyBtn.addEventListener('click', () => {
    const proxyString = proxyInput.value.trim();
    
    if (!proxyString) {
      showStatus('Введите прокси', false);
      return;
    }
    
    try {
      const proxy = parseProxyString(proxyString);
      console.log("Parsed proxy:", proxy);
      
      // Отправляем прокси в background.js для добавления
      chrome.runtime.sendMessage({ 
        action: 'addProxy', 
        proxy: proxy 
      }, (response) => {
        if (response && response.success) {
          proxyInput.value = '';
          showStatus('Прокси добавлен', true);
          // Перезагружаем список прокси
          loadProxyList();
        } else {
          showStatus('Ошибка: ' + (response?.error || 'Неизвестная ошибка'), false);
        }
      });
    } catch (error) {
      showStatus('Ошибка: ' + error.message, false);
    }
  });

  // Функция для обработки списка прокси
  function processProxyList(proxyListText) {
    const lines = proxyListText.split('\n');
    const valid = [];
    const invalid = [];
    
    lines.forEach(line => {
      line = line.trim();
      
      if (!line) return; // Пропускаем пустые строки
      
      try {
        const proxy = parseProxyString(line);
        valid.push(proxy);
      } catch (error) {
        console.error('Invalid proxy format:', line, error);
        invalid.push({ line, error: error.message });
      }
    });
    
    return { valid, invalid };
  }

  // Добавление списка прокси
  addProxyListBtn.addEventListener('click', () => {
    const proxyListText = proxyListInput.value.trim();
    
    if (!proxyListText) {
      showStatus('Введите список прокси', false);
      return;
    }
    
    const result = processProxyList(proxyListText);
    
    if (result.valid.length === 0) {
      showStatus('Нет валидных прокси для добавления', false);
      return;
    }
    
    showStatus('Добавление списка прокси...', false);
    
    chrome.runtime.sendMessage({ 
      action: 'addProxyList', 
      proxies: result.valid 
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      
      if (response && response.success) {
        proxyListInput.value = '';
        
        const totalCount = response.added;
        const failedCount = response.failed || 0;
        
        let message = `Добавлено ${totalCount} прокси.`;
        if (failedCount > 0) {
          message += ` Не удалось добавить ${failedCount} прокси.`;
        }
        
        if (result.invalid.length > 0) {
          message += ` Некорректный формат: ${result.invalid.length} строк.`;
        }
        
        showStatus(message, true);
        
        // Перезагружаем список прокси
        loadProxyList();
      } else {
        showStatus('Ошибка при добавлении прокси: ' + (response?.error || 'Неизвестная ошибка'), false);
      }
    });
  });
  
  // Проверка всех прокси
  checkAllProxiesBtn.addEventListener('click', () => {
    showStatus('Запускаем проверку всех прокси. Это может занять некоторое время.', true);
    
    chrome.runtime.sendMessage({ action: 'checkAllProxies' }, (response) => {
      console.log('Получен ответ на запрос проверки всех прокси:', response);
      
      if (chrome.runtime.lastError) {
        showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      
      if (response && response.success) {
        showStatus(
          `Проверка завершена. Валидных: ${response.valid}, невалидных: ${response.invalid}. Загрузка флагов стран происходит в фоновом режиме.`, 
          true
        );
        // Перезагружаем список прокси
        loadProxyList();
      } else {
        showStatus('Ошибка при проверке прокси: ' + (response?.error || 'Неизвестная ошибка'), false);
      }
    });
  });
  
  // Обработчик для кнопки удаления невалидных прокси
  removeInvalidProxiesBtn.addEventListener('click', function() {
    if (confirm('Вы уверены, что хотите удалить все невалидные прокси?')) {
      removeInvalidProxies();
    }
  });

  // Обработчик для кнопки удаления всех прокси
  removeAllProxiesBtn.addEventListener('click', function() {
    if (confirm('Вы уверены, что хотите удалить ВСЕ прокси из списка? Это действие нельзя отменить.')) {
      removeAllProxies();
    }
  });
  
  // Добавление локального адреса
  addBypassBtn.addEventListener('click', function() {
    const bypassAddress = bypassInput.value.trim();
    if (!bypassAddress) {
      showStatus('Введите локальный адрес', false);
      return;
    }
    
    chrome.runtime.sendMessage({ 
      action: 'addBypassAddress', 
      address: bypassAddress 
    }, function(response) {
      if (chrome.runtime.lastError) {
        showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      
      if (response && response.success) {
        loadBypassList();
        bypassInput.value = '';
        showStatus('Локальный адрес добавлен', true);
      } else {
        const errorMsg = response && response.error ? response.error : 'Не удалось добавить адрес';
        showStatus(`Ошибка: ${errorMsg}`, false);
      }
    });
  });
  
  // Сброс списка локальных адресов к значениям по умолчанию
  resetBypassBtn.addEventListener('click', function() {
    if (confirm('Вы уверены, что хотите сбросить список исключений к значениям по умолчанию?')) {
      chrome.runtime.sendMessage({ action: 'resetBypassList' }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
          return;
        }
        
        if (response && response.success) {
          loadBypassList();
          showStatus('Список локальных адресов сброшен к значениям по умолчанию', true);
        } else {
          const errorMsg = response && response.error ? response.error : 'Не удалось сбросить список';
          showStatus(`Ошибка: ${errorMsg}`, false);
        }
      });
    }
  });

  // Функция для удаления невалидных прокси
  function removeInvalidProxies() {
    if (confirm('Вы уверены, что хотите удалить все невалидные прокси?')) {
      showStatus('Удаление невалидных прокси...', false);
      
      chrome.runtime.sendMessage({ action: 'removeInvalidProxies' }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
          return;
        }
        
        if (response && response.success) {
          if (response.removedCount > 0) {
            showStatus(`${response.message}`, true);
          } else {
            showStatus('Нет невалидных прокси для удаления', true);
          }
          // Перезагружаем список прокси после удаления
          loadProxyList();
        } else {
          const errorMsg = response && response.error ? response.error : 'Не удалось удалить невалидные прокси';
          showStatus(`Ошибка: ${errorMsg}`, false);
        }
      });
    }
  }

  // Функция для удаления всех прокси
  function removeAllProxies() {
    chrome.runtime.sendMessage({ action: 'removeAllProxies' }, function(response) {
      if (response && response.success) {
        showStatus(`Удалено ${response.count} прокси.`, true);
        // Обновляем список прокси
        loadProxyList();
      } else {
        showStatus('Не удалось удалить прокси. Попробуйте еще раз.', false);
      }
    });
  }

  // Функция для парсинга строки прокси в объект
  function parseProxyString(proxyString) {
    let host, port, username = '', password = '';
    
    // Простой формат: ip:port
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(proxyString)) {
      [host, port] = proxyString.split(':');
      
      // Проверка порта
      port = parseInt(port, 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error('Недопустимый порт');
      }
      
      return { host, port, username, password };
    }
    
    // Формат user:password@host:port
    if (proxyString.includes('@')) {
      const parts = proxyString.split('@');
      if (parts.length !== 2) {
        throw new Error('Неверный формат прокси');
      }
      
      const auth = parts[0].split(':');
      if (auth.length !== 2) {
        throw new Error('Неверный формат аутентификации');
      }
      username = auth[0];
      password = auth[1];
      
      const server = parts[1].split(':');
      if (server.length !== 2) {
        throw new Error('Неверный формат хоста:порта');
      }
      host = server[0];
      port = parseInt(server[1], 10);
      
    }
    // Формат host:port:user:pass
    else if (proxyString.includes(':')) {
      const parts = proxyString.split(':');
      
      if (parts.length === 2) {
        // Простой формат host:port (без авторизации)
        host = parts[0];
        port = parseInt(parts[1], 10);
      } else if (parts.length === 4) {
        // Формат host:port:user:pass
        host = parts[0];
        port = parseInt(parts[1], 10);
        username = parts[2];
        password = parts[3];
      } else {
        throw new Error('Неверный формат прокси. Используйте host:port, user:pass@host:port или host:port:user:pass');
      }
    } else {
      throw new Error('Неверный формат прокси');
    }
    
    // Проверки
    if (!host) {
      throw new Error('Хост не может быть пустым');
    }
    
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error('Недопустимый порт');
    }
    
    return { host, port, username, password };
  }

  // Функция для загрузки списка прокси из хранилища
  function loadProxyList() {
    chrome.runtime.sendMessage({ action: 'getProxyList' }, function(response) {
      console.log('Получен ответ от getProxyList:', response);
      proxyListElement.innerHTML = '';
      
      if (!response || !response.proxyList || response.proxyList.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'У вас пока нет добавленных прокси.';
        proxyListElement.appendChild(emptyMessage);
        return;
      }
      
      // Дополнительный лог для диагностики
      console.log('Полученные прокси:', response.proxyList.map(p => ({
        id: p.id,
        host: p.host,
        port: p.port,
        isValid: p.isValid,
        isValidating: p.isValidating,
        country: p.country,
        countryCode: p.countryCode
      })));
      
      // Сохраним ID активного прокси
      const activeProxyId = response.activeProxyId;
      console.log('Active proxy ID:', activeProxyId);
      
      // Отрисовка списка прокси
      response.proxyList.forEach((proxy, index) => {
        console.log('Рисуем прокси:', proxy);
        const proxyItem = document.createElement('div');
        proxyItem.className = 'proxy-item';
        
        // Проверяем, активен ли этот прокси
        if ((activeProxyId && proxy.id === activeProxyId) || proxy.isActive) {
          proxyItem.classList.add('proxy-item-active');
          console.log('Найден активный прокси:', proxy.host, proxy.port);
        }
        
        // Информация о прокси
        const proxyInfo = document.createElement('div');
        proxyInfo.className = 'proxy-info';
        
        // Добавляем информацию о стране только если она есть и только в виде флага
        if (proxy.country && proxy.countryCode) {
          const flagContainer = document.createElement('span');
          flagContainer.style.marginRight = '10px';
          
          const flagImg = document.createElement('img');
          flagImg.src = `https://flagcdn.com/16x12/${proxy.countryCode.toLowerCase()}.png`;
          flagImg.alt = proxy.country;
          flagImg.title = proxy.country; // Показываем название страны при наведении
          flagImg.className = 'flag';
          
          flagContainer.appendChild(flagImg);
          proxyInfo.appendChild(flagContainer);
        }
        
        // Основная информация - адрес и порт
        const address = document.createElement('span');
        address.textContent = `${proxy.host}:${proxy.port}`;
        proxyInfo.appendChild(address);
        
        // Время ответа
        if (proxy.responseTime && proxy.isValid) {
          const responseTime = document.createElement('span');
          responseTime.style.marginLeft = '10px';
          responseTime.style.color = '#28a745';
          responseTime.textContent = `${proxy.responseTime} мс`;
          proxyInfo.appendChild(responseTime);
        }
        
        // Статус валидности
        if (proxy.isValidating) {
          // Если прокси в процессе проверки
          const statusSpan = document.createElement('span');
          statusSpan.className = 'proxy-status validating';
          statusSpan.textContent = 'Проверяется...';
          proxyInfo.appendChild(statusSpan);
        } else if (proxy.isValid !== undefined) {
          const statusSpan = document.createElement('span');
          statusSpan.className = `proxy-status ${proxy.isValid ? 'valid' : 'invalid'}`;
          statusSpan.textContent = proxy.isValid ? 'Валидный' : 'Невалидный';
          proxyInfo.appendChild(statusSpan);
        } else {
          const statusSpan = document.createElement('span');
          statusSpan.className = 'proxy-status unknown';
          statusSpan.textContent = 'Непроверенный';
          proxyInfo.appendChild(statusSpan);
        }
        
        proxyItem.appendChild(proxyInfo);
        
        // Кнопки управления
        const buttonsDiv = document.createElement('div');
        
        // Кнопка активации
        const activateBtn = document.createElement('button');
        activateBtn.textContent = 'Активировать';
        activateBtn.addEventListener('click', () => activateProxy(proxy.id));
        buttonsDiv.appendChild(activateBtn);
        
        // Кнопка проверки
        const checkBtn = document.createElement('button');
        checkBtn.textContent = 'Проверить';
        checkBtn.addEventListener('click', () => checkProxyValidity(proxy.id));
        buttonsDiv.appendChild(checkBtn);
        
        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удалить';
        deleteBtn.className = 'delete';
        deleteBtn.addEventListener('click', () => deleteProxy(proxy.id));
        buttonsDiv.appendChild(deleteBtn);
        
        proxyItem.appendChild(buttonsDiv);
        proxyListElement.appendChild(proxyItem);
      });
    });
  }
  
  // Функция для загрузки списка локальных адресов
  function loadBypassList() {
    chrome.runtime.sendMessage({ action: 'getBypassList' }, (response) => {
      bypassListContainer.innerHTML = '';
      
      if (!response || !response.bypassList || response.bypassList.length === 0) {
        bypassListContainer.textContent = 'Нет исключений';
        return;
      }
      
      response.bypassList.forEach(address => {
        const item = document.createElement('div');
        item.className = 'bypass-item';
        
        const addressSpan = document.createElement('span');
        addressSpan.textContent = address;
        item.appendChild(addressSpan);
        
        // Добавляем кнопку удаления только если это не дефолтное исключение
        if (!address.startsWith('localhost') && address !== '<local>') {
          const removeBtn = document.createElement('span');
          removeBtn.className = 'bypass-remove';
          removeBtn.textContent = '✕';
          removeBtn.title = 'Удалить';
          removeBtn.addEventListener('click', () => removeBypassAddress(address));
          item.appendChild(removeBtn);
        }
        
        bypassListContainer.appendChild(item);
      });
    });
  }
  
  // Функция для удаления локального адреса
  function removeBypassAddress(address) {
    chrome.runtime.sendMessage({ 
      action: 'removeBypassAddress', 
      address: address 
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      
      if (response && response.success) {
        showStatus('Адрес удален из исключений', true);
        loadBypassList();
      } else {
        const errorMsg = response && response.error ? response.error : 'Не удалось удалить адрес';
        showStatus(`Ошибка: ${errorMsg}`, false);
      }
    });
  }

  // Функция для активации прокси
  function activateProxy(proxyId) {
    console.log('Активация прокси с ID:', proxyId);
    
    chrome.runtime.sendMessage({ 
      action: 'setActiveProxy', 
      proxyId: proxyId 
    }, function(response) {
      console.log('Ответ после активации прокси:', response);
      
      if (response && response.success) {
        showStatus('Прокси активирован', true);
        loadProxyList(); // Перезагружаем список прокси для обновления UI
      } else {
        showStatus('Ошибка при активации прокси', false);
      }
    });
  }
  
  // Функция для проверки валидности прокси
  function checkProxyValidity(proxyId) {
    showStatus('Проверка прокси...', true);
    
    chrome.runtime.sendMessage({ 
      action: 'checkProxyValidity', 
      proxyId: proxyId,
      skipGeoInfo: false // явно запрашиваем геоинформацию для одиночной проверки
    }, (response) => {
      if (response && response.success) {
        showStatus('Проверка запущена. Результаты будут доступны через несколько секунд', true);
        
        // Перезагружаем список прокси через некоторое время, чтобы увидеть обновленный статус
        setTimeout(() => {
          loadProxyList();
        }, 3000); // Ждем 3 секунды перед обновлением списка
      } else {
        showStatus('Ошибка при проверке прокси', false);
      }
    });
  }

  // Функция для удаления прокси
  function deleteProxy(proxyId) {
    if (confirm('Вы уверены, что хотите удалить этот прокси?')) {
      chrome.runtime.sendMessage({ 
        action: 'removeProxy', 
        proxyId: proxyId
      }, (response) => {
        if (response && response.success) {
          showStatus('Прокси удален', true);
          loadProxyList();
        } else {
          showStatus('Ошибка при удалении прокси', false);
        }
      });
    }
  }

  // Функция отображения статуса
  function showStatus(message, isSuccess) {
    // Сначала удаляем старый статус, если он есть
    if (statusDiv.style.display === 'block') {
      statusDiv.style.display = 'none';
    }
    
    // Устанавливаем новый текст и класс
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + (isSuccess ? 'success' : 'error');
    
    // Отображаем статус
    statusDiv.style.display = 'block';
    
    // Устанавливаем таймер для автоматического скрытия
    const hideTimeout = setTimeout(() => {
      statusDiv.style.opacity = '0';
      statusDiv.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        statusDiv.style.display = 'none';
        statusDiv.style.opacity = '1';
        statusDiv.style.transform = 'translateY(0)';
      }, 300); // Время для анимации исчезновения
    }, 4000); // Время отображения уведомления
    
    // Добавляем возможность закрыть статус по клику
    statusDiv.onclick = function() {
      clearTimeout(hideTimeout);
      statusDiv.style.display = 'none';
    };
  }
  
  // Обработчики для кнопок "Купить прокси"
  if (buyProxyBtn) {
    buyProxyBtn.addEventListener('click', function() {
      showStatus('Функция покупки прокси находится в разработке', true);
    });
  }
  
  if (buyProxyBypassBtn) {
    buyProxyBypassBtn.addEventListener('click', function() {
      showStatus('Функция покупки прокси находится в разработке', true);
    });
  }
}); 