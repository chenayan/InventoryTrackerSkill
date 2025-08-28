// Unit tests for utility functions
describe('Japanese Food Mapping', () => {
  const japaneseToEnglish = {
    'にんじん': 'carrots',
    '人参': 'carrots',
    'ニンジン': 'carrots',
    'キャロット': 'carrots',
    'たまご': 'eggs',
    '卵': 'eggs',
    'タマゴ': 'eggs',
    'エッグ': 'eggs',
    '牛乳': 'milk',
    'ミルク': 'milk',
    'ぎゅうにゅう': 'milk',
    'りんご': 'apples',
    'リンゴ': 'apples',
    'アップル': 'apples',
    'パン': 'bread',
    'ぱん': 'bread',
    'ブレッド': 'bread',
    'バター': 'butter',
    'ばたー': 'butter',
    'チーズ': 'cheese',
    'ちーず': 'cheese',
    '米': 'rice',
    'お米': 'rice',
    'こめ': 'rice',
    'ライス': 'rice'
  };

  const englishToJapanese = {
    'carrots': 'にんじん',
    'eggs': 'たまご',
    'milk': '牛乳',
    'apples': 'りんご',
    'bread': 'パン',
    'butter': 'バター',
    'cheese': 'チーズ',
    'rice': '米'
  };

  describe('Japanese to English mapping', () => {
    it('should map hiragana food names correctly', () => {
      expect(japaneseToEnglish['にんじん']).toBe('carrots');
      expect(japaneseToEnglish['たまご']).toBe('eggs');
      expect(japaneseToEnglish['ぎゅうにゅう']).toBe('milk');
      expect(japaneseToEnglish['りんご']).toBe('apples');
    });

    it('should map kanji food names correctly', () => {
      expect(japaneseToEnglish['人参']).toBe('carrots');
      expect(japaneseToEnglish['卵']).toBe('eggs');
      expect(japaneseToEnglish['牛乳']).toBe('milk');
    });

    it('should map katakana food names correctly', () => {
      expect(japaneseToEnglish['ニンジン']).toBe('carrots');
      expect(japaneseToEnglish['タマゴ']).toBe('eggs');
      expect(japaneseToEnglish['ミルク']).toBe('milk');
      expect(japaneseToEnglish['リンゴ']).toBe('apples');
    });

    it('should map English food names correctly', () => {
      expect(japaneseToEnglish['キャロット']).toBe('carrots');
      expect(japaneseToEnglish['エッグ']).toBe('eggs');
      expect(japaneseToEnglish['アップル']).toBe('apples');
      expect(japaneseToEnglish['ブレッド']).toBe('bread');
    });

    it('should handle unknown items by returning undefined', () => {
      expect(japaneseToEnglish['バナナ']).toBeUndefined();
      expect(japaneseToEnglish['トマト']).toBeUndefined();
    });
  });

  describe('English to Japanese mapping', () => {
    it('should map English food names to Japanese correctly', () => {
      expect(englishToJapanese['carrots']).toBe('にんじん');
      expect(englishToJapanese['eggs']).toBe('たまご');
      expect(englishToJapanese['milk']).toBe('牛乳');
      expect(englishToJapanese['apples']).toBe('りんご');
    });

    it('should handle unknown items by returning undefined', () => {
      expect(englishToJapanese['bananas']).toBeUndefined();
      expect(englishToJapanese['tomatoes']).toBeUndefined();
    });
  });

  describe('Bidirectional mapping consistency', () => {
    it('should have consistent mappings between Japanese and English', () => {
      const englishValues = Object.values(japaneseToEnglish);
      const uniqueEnglishValues = [...new Set(englishValues)];
      
      uniqueEnglishValues.forEach(englishValue => {
        expect(englishToJapanese[englishValue]).toBeDefined();
      });
    });
  });

  describe('Item key generation', () => {
    function generateItemKey(englishItem, location = '冷蔵庫') {
      return `${englishItem.toLowerCase()}_${location}`;
    }

    it('should generate correct storage keys', () => {
      expect(generateItemKey('carrots')).toBe('carrots_冷蔵庫');
      expect(generateItemKey('EGGS')).toBe('eggs_冷蔵庫');
      expect(generateItemKey('Milk', 'パントリー')).toBe('milk_パントリー');
    });

    it('should handle case insensitive item names', () => {
      expect(generateItemKey('CARROTS')).toBe('carrots_冷蔵庫');
      expect(generateItemKey('CaRrOtS')).toBe('carrots_冷蔵庫');
    });
  });

  describe('Quantity parsing', () => {
    function parseQuantity(value) {
      const parsed = parseInt(value);
      return isNaN(parsed) ? 1 : parsed;
    }

    it('should parse valid numbers', () => {
      expect(parseQuantity('4')).toBe(4);
      expect(parseQuantity('10')).toBe(10);
      expect(parseQuantity('1')).toBe(1);
    });

    it('should handle invalid inputs with default value', () => {
      expect(parseQuantity('')).toBe(1);
      expect(parseQuantity('abc')).toBe(1);
      expect(parseQuantity(null)).toBe(1);
      expect(parseQuantity(undefined)).toBe(1);
    });

    it('should handle string numbers', () => {
      expect(parseQuantity('0')).toBe(0);
      expect(parseQuantity('100')).toBe(100);
    });
  });
});