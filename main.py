import pygame
from constants import SCREEN_WIDTH, SCREEN_HEIGHT
from logger import log_state
# or import everything: from module_name import *
def main():
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    while True:
        log_state()
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            return
    screen.fill("black")
    print(f"Starting Asteroids with pygame version: {pygame.version.ver}")
    print("Screen width: 1280")
    print("Screen height: 720")
    pygame.display.flip()

if __name__ == "__main__":
    main()

