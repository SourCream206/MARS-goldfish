"""
Rocket Velocity & Motor Calculations — Simple Formula Animation
================================================================
Run with:
    manim -pql rocket_velocity.py RocketVelocity   # preview
    manim -pqh rocket_velocity.py RocketVelocity   # high quality
"""

from manim import *


GOLD = "#C9A84C"


class RocketVelocity(Scene):
    def construct(self):
        self.camera.background_color = WHITE

        formulas = [
            (
                r"I_{SP} = 189 \ \text{s}",
                "Specific Impulse (from thrustcurve.org)"
            ),
            (
                r"v_e = g \times I_{SP}",
                "Exhaust Velocity Formula"
            ),
            (
                r"v_e = 9.81 \times 189 = 1854.09 \ \text{m/s}",
                "Solving for Exhaust Velocity"
            ),
            (
                r"\Delta v = v_e \ln\frac{m_i}{m_f}",
                "Tsiolkovsky Rocket Equation"
            ),
            (
                r"\Delta v = 1854.09 \ln\frac{1150 + 50}{1150}",
                "Substituting Mass Values"
            ),
            (
                r"\Delta v = 78.91 \ \text{m/s}",
                "Final \u0394v"
            ),
        ]

        title = Text("Rocket Velocity & Motor Calculations",
                     font_size=36, color=GOLD, weight=BOLD)
        title.to_edge(UP, buff=0.5)
        underline = Line(title.get_left(), title.get_right(),
                         color=GOLD, stroke_width=2)
        underline.next_to(title, DOWN, buff=0.08)

        self.play(Write(title), Create(underline), run_time=1.2)
        self.wait(0.3)

        current_label = None
        current_eq    = None

        for latex, label_text in formulas:
            label = Text(label_text, font_size=26, color=GOLD, slant=ITALIC)
            label.move_to(UP * 0.8)

            eq = MathTex(latex, color=GOLD, font_size=46)
            eq.move_to(DOWN * 0.5)

            if current_eq is None:
                self.play(FadeIn(label, shift=UP*0.2),
                          Write(eq), run_time=1.0)
            else:
                self.play(
                    FadeOut(current_label, shift=UP*0.15),
                    FadeOut(current_eq,    shift=UP*0.15),
                    run_time=0.5
                )
                self.play(
                    FadeIn(label, shift=UP*0.2),
                    Write(eq),
                    run_time=1.0
                )

            self.wait(2.0)
            current_label = label
            current_eq    = eq

        self.wait(1)
        self.play(FadeOut(*self.mobjects), run_time=0.8)