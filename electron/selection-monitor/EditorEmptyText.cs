namespace Lexforge.SelectionMonitor;

internal static class EditorEmptyText
{
    private static readonly char[] BoundaryMarkers = ['\r', '\n', '\u2028', '\u2029', '\u200B', '\uFEFF'];

    internal static string TrimBoundaryMarkers(string text) => text.Trim(BoundaryMarkers);

    internal static bool IsEmpty(string text, bool? valueEmpty = null)
    {
        // A non-empty ValuePattern always wins. An embedded object is not blank
        // unless the editable control separately confirms its value is empty.
        if (valueEmpty == false) return false;
        var content = TrimBoundaryMarkers(text);
        return content.Length == 0 || (valueEmpty == true && content == "\uFFFC");
    }
}
