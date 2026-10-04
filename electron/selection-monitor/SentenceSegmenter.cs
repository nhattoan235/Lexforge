namespace Lexforge.SelectionMonitor;

internal static class SentenceSegmenter
{
    internal static bool IsDraftEligible(string text, int maxLength) =>
        text.Length is >= 12 && text.Length <= maxLength &&
        text.Count(char.IsLetter) >= 8 &&
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 3;

    private static readonly HashSet<string> Abbreviations = new(StringComparer.OrdinalIgnoreCase)
    {
        "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e", "u.s", "u.k"
    };

    internal static (int Start, int Length)? FindActiveSentence(string text, int caret)
    {
        if (string.IsNullOrWhiteSpace(text) || caret < 0 || caret > text.Length) return null;
        var sentences = new List<(int Start, int Length)>();
        var start = SkipSpace(text, 0);
        for (var i = start; i < text.Length; i++)
        {
            if (text[i] is '\r' or '\n')
            {
                AddSentence(text, start, i, sentences);
                start = SkipSpace(text, i + 1);
                i = Math.Max(i, start - 1);
                continue;
            }
            if (!IsTerminator(text, i)) continue;
            var end = i + 1;
            while (end < text.Length && text[end] is '!' or '?' or '.') end++;
            while (end < text.Length && text[end] is '\"' or '\'' or ')' or ']' or '}' or '”' or '’') end++;
            if (end < text.Length && !char.IsWhiteSpace(text[end])) continue;
            AddSentence(text, start, end, sentences);
            start = SkipSpace(text, end);
            i = Math.Max(i, start - 1);
        }
        AddSentence(text, start, text.Length, sentences);
        if (sentences.Count == 0) return null;
        foreach (var sentence in sentences)
            if (caret >= sentence.Start && caret <= sentence.Start + sentence.Length)
                return sentence;
        for (var i = sentences.Count - 1; i >= 0; i--)
            if (caret > sentences[i].Start + sentences[i].Length) return sentences[i];
        return sentences[0];
    }

    private static bool IsTerminator(string text, int index)
    {
        var current = text[index];
        if (current is '!' or '?') return true;
        if (current != '.') return false;
        if (index > 0 && index + 1 < text.Length &&
            char.IsDigit(text[index - 1]) && char.IsDigit(text[index + 1])) return false;
        if (index + 1 < text.Length && text[index + 1] == '.') return false;
        var tokenStart = index - 1;
        while (tokenStart >= 0 && (char.IsLetter(text[tokenStart]) || text[tokenStart] == '.')) tokenStart--;
        var token = text[(tokenStart + 1)..index].Trim('.');
        return !Abbreviations.Contains(token);
    }

    private static int SkipSpace(string text, int index)
    {
        while (index < text.Length && char.IsWhiteSpace(text[index])) index++;
        return index;
    }

    private static void AddSentence(string text, int start, int end, List<(int Start, int Length)> result)
    {
        while (start < end && char.IsWhiteSpace(text[start])) start++;
        while (end > start && char.IsWhiteSpace(text[end - 1])) end--;
        if (end > start) result.Add((start, end - start));
    }
}
