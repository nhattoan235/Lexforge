using Lexforge.SelectionMonitor;

static void Check(string text, int caret, string expected)
{
    var span = SentenceSegmenter.FindActiveSentence(text, caret)
        ?? throw new Exception($"No sentence found for caret {caret}");
    var actual = text.Substring(span.Start, span.Length);
    if (actual != expected)
        throw new Exception($"Expected [{expected}], got [{actual}]");
}

var twoSentences = "I went home. She go to school.";
Check(twoSentences, twoSentences.Length, "She go to school.");
Check(twoSentences, 5, "I went home.");
Check("I am writing a sentence without punctuation", 43,
    "I am writing a sentence without punctuation");
var abbreviation = "Dr. Smith is here. He go home.";
Check(abbreviation, abbreviation.Length, "He go home.");
Check(abbreviation, 7, "Dr. Smith is here.");
var decimalText = "The value is 3.14. It works.";
Check(decimalText, 14, "The value is 3.14.");
var paragraph = "First sentence\nSecond sentence";
Check(paragraph, paragraph.Length, "Second sentence");
var quotation = "She asked, \"Are you okay?\" He say yes.";
Check(quotation, quotation.Length, "He say yes.");
var shortQuestion = "hello washup, my name is Pi. what you name.";
Check(shortQuestion, shortQuestion.Length, "what you name.");
if (!SentenceSegmenter.IsDraftEligible("what you name.", 350))
    throw new Exception("A three-word question should be eligible for writing suggestions.");
if (SentenceSegmenter.IsDraftEligible("name.", 350))
    throw new Exception("A single word should not trigger writing suggestions.");
Console.WriteLine("11 sentence and eligibility checks passed.");

var scheduler = new InputReadScheduler(250, 2000);
var window = new IntPtr(1);
if (scheduler.ShouldRead(0, window, 1) || scheduler.ShouldRead(200, window, 1))
    throw new Exception("Input should defer accessibility reads while typing.");
if (!scheduler.ShouldRead(250, window, 1) || scheduler.ShouldRead(300, window, 1))
    throw new Exception("Input should trigger one read after a quiet interval.");
if (scheduler.ShouldRead(2200, window, 2) || !scheduler.ShouldRead(2450, window, 2))
    throw new Exception("New input should postpone the next read.");
if (scheduler.ShouldRead(3000, window, 2) || !scheduler.ShouldRead(4450, window, 2))
    throw new Exception("An idle editor should receive a periodic refresh.");
if (scheduler.ShouldRead(4500, new IntPtr(2), 2) || !scheduler.ShouldRead(4750, new IntPtr(2), 2))
    throw new Exception("Changing windows should schedule a fresh read.");
scheduler.Reset();
if (scheduler.ShouldRead(4800, new IntPtr(2), 2) || !scheduler.ShouldRead(5050, new IntPtr(2), 2))
    throw new Exception("A selection gesture should schedule a new read.");
Console.WriteLine("6 input scheduling checks passed.");

var typingPause = new InputReadScheduler(700, 2000);
foreach (var (time, tick) in new[] { (0L, 1u), (200L, 2u), (400L, 3u), (600L, 4u) })
    if (typingPause.ShouldRead(time, window, tick))
        throw new Exception("A new keystroke must restart the 700 ms pause.");
if (typingPause.ShouldRead(1299, window, 4) || !typingPause.ShouldRead(1300, window, 4))
    throw new Exception("The draft should be read only after 700 ms without input.");
Console.WriteLine("Typing pause check passed.");

foreach (var empty in new[] { "", "\r\n", "\u200B", "\uFEFF", "\u200B\r\n\u2029" })
    if (!EditorEmptyText.IsEmpty(empty))
        throw new Exception("An empty editor marker must permit insertion without selecting it as a sentence.");
foreach (var content in new[] { "hello", " ", ".", "\uFFFC", "\u200Bhello", "\r\nhello", new string('\n', 4) + "text" })
    if (EditorEmptyText.IsEmpty(content))
        throw new Exception("Existing content must never be classified as an empty editor.");
if (!EditorEmptyText.IsEmpty("\uFFFC", true) ||
    EditorEmptyText.IsEmpty("\uFFFC", false) || EditorEmptyText.IsEmpty("\u200B", false) ||
    EditorEmptyText.IsEmpty("hello", true))
    throw new Exception("Embedded objects require an independently confirmed empty value; visible text is never empty.");
if (EditorEmptyText.TrimBoundaryMarkers("\u200BHello.\r\n") != "Hello." ||
    EditorEmptyText.TrimBoundaryMarkers("Hello\u200Bworld") != "Hello\u200Bworld")
    throw new Exception("Verification may trim editor boundary markers but must preserve internal content.");
Console.WriteLine("Empty editor recognition and content preservation checks passed.");
